package org.example.easyitp.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.SmsProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;

// Trimite un SMS pe canalul ales de statie:
//  - SMS_GATE: telefonul statiei, prin aplicatia "SMS Gateway for Android" in modul cloud (https://docs.sms-gate.app);
//  - SMSLINK: gateway-ul SMSLink.ro (https://www.smslink.ro/sms-gateway-documentatie-sms-gateway.html).
// Nu se reincearca daca cererea a plecat (SMS-ul ar putea ajunge de doua ori); erorile devin DeliveryException.
@Service
@Slf4j
public class SmsSender {

    public static final String SMS_GATE_DEFAULT_URL = "https://api.sms-gate.app";
    // Un SMS care nu poate pleca in 6 ore (telefon oprit) nu mai e trimis
    private static final int SMS_GATE_TTL_SECONDS = 6 * 3600;

    private final RestClient client;
    private final String smslinkUrl;
    private final String smsGateDefaultUrl;
    private final SmsQuotaService quota;

    public SmsSender(@Value("${smslink.url:https://secure.smslink.ro/sms/gateway/communicate/json.php}") String smslinkUrl,
                     @Value("${smsgate.url:" + SMS_GATE_DEFAULT_URL + "}") String smsGateDefaultUrl,
                     SmsQuotaService quota) {
        this.quota = quota;
        // Corpul cu Content-Length (nu "chunked"): unele gateway-uri nu accepta cereri fragmentate
        this.client = RestClient.builder()
                .requestFactory(new BufferingClientHttpRequestFactory(
                        HttpTimeouts.factory(Duration.ofSeconds(10), Duration.ofSeconds(30))))
                .build();
        this.smslinkUrl = smslinkUrl;
        this.smsGateDefaultUrl = smsGateDefaultUrl;
    }

    // Intoarce id-ul mesajului la furnizor
    public String send(AppUser station, String phone, String text) {
        SmsProvider provider = station.getAutoSmsProvider();
        if (provider == null) throw new DeliveryException("Alegeți cum se trimit SMS-urile.");
        String digits = phoneDigits(phone);
        if (digits == null) throw new DeliveryException("Numărul de telefon nu poate primi SMS.");
        return switch (provider) {
            case SMS_GATE -> sendSmsGate(station, digits, text);
            case SMSLINK -> sendSmsLink(station, station.getSmslinkConnectionId(), station.getSmslinkPassword(), digits, text);
            case PLATFORM -> sendPlatform(station, digits, text);
        };
    }

    // Inclus in abonament: contul SMSLink al platformei; fiecare parte a mesajului se scade din pachetul lunii
    private String sendPlatform(AppUser station, String digits, String text) {
        if (quota == null || !quota.platformAvailable()) {
            throw new DeliveryException("SMS-urile incluse în abonament nu sunt disponibile momentan.");
        }
        int parts = SmsText.segments(text);
        quota.checkRoom(station, parts);
        String id = sendSmsLink(station, quota.connectionId(), quota.password(), digits, text);
        quota.record(station, parts);
        return id;
    }

    private String sendSmsGate(AppUser station, String digits, String text) {
        String username = station.getSmsGateUsername();
        String password = station.getSmsGatePassword();
        if (blank(username) || blank(password)) {
            throw new DeliveryException("Lipsesc utilizatorul și parola din aplicația SMS Gateway.");
        }
        String base = station.getSmsGateUrl() == null || station.getSmsGateUrl().isBlank()
                ? smsGateDefaultUrl : smsGateBase(station.getSmsGateUrl());
        URI uri = URI.create(base + "/3rdparty/v1/messages");
        String auth = Base64.getEncoder().encodeToString((username.trim() + ":" + password.trim()).getBytes(StandardCharsets.UTF_8));
        try {
            JsonNode body = client.post().uri(uri)
                    .header(HttpHeaders.AUTHORIZATION, "Basic " + auth)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("textMessage", Map.of("text", text), "phoneNumbers", List.of("+" + digits),
                            "ttl", SMS_GATE_TTL_SECONDS))
                    .retrieve()
                    .body(JsonNode.class);
            return body == null ? null : body.path("id").asText(null);
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            log.warn("SMS Gateway a raspuns {} pentru statia {}", status, station.getId());
            if (status == 401 || status == 403) throw new DeliveryException("Utilizatorul sau parola din aplicația SMS Gateway sunt greșite.");
            if (status == 429 || status == 503) throw new DeliveryException("Serverul SMS Gateway este ocupat. Se reîncearcă mâine.");
            throw new DeliveryException("SMS Gateway a refuzat mesajul (" + status + ").");
        } catch (RestClientException e) {
            log.warn("SMS Gateway indisponibil pentru statia {}: {}", station.getId(), e.getClass().getSimpleName());
            throw new DeliveryException("Serverul SMS Gateway nu răspunde.");
        }
    }

    private String sendSmsLink(AppUser station, String connectionId, String password, String digits, String text) {
        if (blank(connectionId) || blank(password)) throw new DeliveryException("Lipsesc datele conexiunii SMSLink.");
        // SMSLink vrea numerele romanesti in forma nationala (07xxxxxxxx)
        String to = digits.startsWith("40") ? "0" + digits.substring(2) : "00" + digits;
        try {
            JsonNode body = client.get()
                    .uri(smslinkUrl + "?connection_id={c}&password={p}&to={to}&message={m}",
                            connectionId.trim(), password.trim(), to, text)
                    .retrieve()
                    .body(JsonNode.class);
            if (body != null && "MESSAGE".equals(body.path("response_type").asText())) {
                return body.path("message_id").asText(null);
            }
            String reason = body == null ? "" : body.path("response_message").asText("");
            log.warn("SMSLink a refuzat mesajul pentru statia {}: {}", station.getId(), abbreviate(reason));
            throw new DeliveryException("SMSLink a refuzat mesajul" + (reason.isBlank() ? "." : ": " + abbreviate(reason)));
        } catch (RestClientException e) {
            // mesajul exceptiei contine URL-ul cu parola, deci nu se logheaza
            log.warn("SMSLink indisponibil pentru statia {}: {}", station.getId(), e.getClass().getSimpleName());
            throw new DeliveryException("SMSLink nu răspunde.");
        }
    }

    // Adresa serverului SMS Gateway: implicit cel public; unul propriu doar pe https si cu nume de domeniu
    // (nu IP-uri sau localhost, ca serverul nostru sa nu poata fi folosit sa sondeze retele interne)
    public static String validSmsGateUrl(String configured) {
        return smsGateBase(configured);
    }

    static String smsGateBase(String configured) {
        if (blank(configured)) return SMS_GATE_DEFAULT_URL;
        String url = configured.trim().replaceAll("/+$", "");
        URI uri;
        try {
            uri = URI.create(url);
        } catch (IllegalArgumentException e) {
            throw new DeliveryException("Adresa serverului SMS Gateway nu este validă.");
        }
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        if (!"https".equals(uri.getScheme()) || host.isEmpty() || host.equals("localhost") || !host.contains(".")
                || host.matches("[0-9.]+") || host.contains(":")) {
            throw new DeliveryException("Adresa serverului SMS Gateway trebuie să fie https://, cu nume de domeniu.");
        }
        return url;
    }

    // Numarul in format international, doar cifre (4072...); null daca nu poate primi SMS.
    // Numerele romanesti trebuie sa fie de mobil (07...)
    public static String phoneDigits(String phone) {
        if (phone == null) return null;
        String digits = phone.replaceAll("\\D", "");
        if (digits.startsWith("00")) digits = digits.substring(2);
        else if (digits.startsWith("0")) digits = "40" + digits.substring(1);
        if (digits.startsWith("40")) return digits.length() == 11 && digits.charAt(2) == '7' ? digits : null;
        return digits.length() >= 10 && digits.length() <= 15 ? digits : null;
    }

    private static String abbreviate(String s) {
        return s.length() > 200 ? s.substring(0, 200) : s;
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
