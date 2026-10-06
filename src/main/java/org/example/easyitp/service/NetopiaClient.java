package org.example.easyitp.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;

// NETOPIA Payments API v2 (https://doc.netopia-payments.com): pornirea unei plati cu cardul (clientul e trimis pe
// pagina lor) si starea unei tranzactii. Cheia API si semnatura POS stau doar in variabilele de mediu.
@Component
@Slf4j
public class NetopiaClient {

    // Platit (3) sau confirmat (5)
    public static boolean isPaid(int status) {
        return status == 3 || status == 5;
    }

    // Respinsa / anulata / expirata
    public static boolean isFailed(int status) {
        return status == 2 || status == 4 || status == 11 || status == 12 || status == 13;
    }

    public record Started(String ntpId, String paymentUrl) {
    }

    public record Billing(String email, String phone, String name, String address, String city, String county) {
    }

    private final RestClient client;
    private final String apiKey;
    private final String posSignature;

    public NetopiaClient(@Value("${netopia.url:https://secure.sandbox.netopia-payments.com}") String baseUrl,
                         @Value("${netopia.api-key:}") String apiKey,
                         @Value("${netopia.pos-signature:}") String posSignature) {
        this.client = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(new BufferingClientHttpRequestFactory(
                        HttpTimeouts.factory(Duration.ofSeconds(10), Duration.ofSeconds(30))))
                .build();
        this.apiKey = apiKey;
        this.posSignature = posSignature;
    }

    public boolean available() {
        return apiKey != null && !apiKey.isBlank() && posSignature != null && !posSignature.isBlank();
    }

    public Started start(String orderId, BigDecimal amount, String description, Billing billing,
                         String notifyUrl, String redirectUrl) {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("emailTemplate", "");
        config.put("emailSubject", "");
        config.put("notifyUrl", notifyUrl);
        config.put("redirectUrl", redirectUrl);
        config.put("language", "ro");

        String[] names = splitName(billing.name());
        Map<String, Object> address = new LinkedHashMap<>();
        address.put("email", billing.email());
        address.put("phone", billing.phone());
        address.put("firstName", names[0]);
        address.put("lastName", names[1]);
        address.put("city", billing.city());
        address.put("country", 642);
        address.put("countryName", "Romania");
        address.put("state", billing.county() == null ? billing.city() : billing.county());
        address.put("postalCode", "");
        address.put("details", billing.address());

        Map<String, Object> order = new LinkedHashMap<>();
        order.put("ntpID", "");
        order.put("posSignature", posSignature);
        order.put("dateTime", OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
        order.put("description", description);
        order.put("orderID", orderId);
        order.put("amount", amount);
        order.put("currency", "RON");
        order.put("billing", address);
        order.put("installments", Map.of("selected", 0, "available", java.util.List.of(0)));
        order.put("data", Map.of());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("config", config);
        body.put("payment", Map.of("options", Map.of("installments", 0, "bonus", 0), "data", Map.of()));
        body.put("order", order);

        JsonNode res = post("/payment/card/start", body);
        String url = res.path("payment").path("paymentURL").asText(null);
        if (url == null || url.isBlank()) {
            // codul 101 ("Redirect user to payment page") e raspunsul normal; altceva fara link = eroare
            throw new DeliveryException("Netopia: " + res.path("error").path("message").asText("plata nu a putut fi pornită"));
        }
        return new Started(res.path("payment").path("ntpID").asText(null), url);
    }

    // Starea tranzactiei la Netopia (sursa de adevar, nu notificarea primita)
    public int status(String ntpId, String orderId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("posID", posSignature);
        body.put("ntpID", ntpId == null ? "" : ntpId);
        body.put("orderID", orderId);
        JsonNode res = post("/operation/status", body);
        return res.path("payment").path("status").asInt(0);
    }

    private JsonNode post(String path, Object body) {
        try {
            JsonNode res = client.post().uri(path)
                    .header("Authorization", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve().body(JsonNode.class);
            if (res == null) throw new DeliveryException("Netopia nu a răspuns.");
            return res;
        } catch (RestClientResponseException e) {
            log.warn("Netopia {}: {} {}", path, e.getStatusCode(), e.getResponseBodyAsString());
            throw new DeliveryException("Netopia a refuzat cererea. Încercați din nou mai târziu.");
        } catch (RestClientException e) {
            log.warn("Netopia {}: {}", path, e.getMessage());
            throw new DeliveryException("Netopia nu a răspuns. Încercați din nou.");
        }
    }

    // Netopia cere prenume + nume; numele firmei merge intreg la prenume daca e un singur cuvant
    static String[] splitName(String name) {
        String n = name == null ? "" : name.trim();
        int i = n.lastIndexOf(' ');
        if (i <= 0) return new String[]{n, n};
        return new String[]{n.substring(0, i), n.substring(i + 1)};
    }
}
