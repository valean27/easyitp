package org.example.easyitp.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Locale;

// Trimite mesaje WhatsApp catre propriul numar al managerului prin CallMeBot (gratuit, uz personal).
// Fiecare manager isi activeaza cheia trimitand "I allow callmebot to send me messages" catre bot.
// Documentatie: https://www.callmebot.com/blog/free-api-whatsapp-messages/
@Service
@Slf4j
public class WhatsAppService {

    public static final String BOT_NUMBER = "+34644992698";
    public static final String ACTIVATION_TEXT = "I allow callmebot to send me messages";

    private final RestClient client;

    public WhatsAppService(@Value("${callmebot.url:https://api.callmebot.com}") String baseUrl) {
        this.client = RestClient.builder().baseUrl(baseUrl).build();
    }

    public void send(String phone, String apiKey, String text) {
        String to = normalizePhone(phone);
        if (to == null) throw new DeliveryException("Numărul de WhatsApp nu este valid.");
        if (apiKey == null || apiKey.isBlank()) throw new DeliveryException("Lipsește cheia CallMeBot.");

        ResponseEntity<String> response;
        try {
            // Valorile din variabilele de template sunt codate complet ("+" -> %2B, diacritice, linii noi)
            response = client.get()
                    .uri("/whatsapp.php?phone={phone}&text={text}&apikey={apikey}", to, text, apiKey.trim())
                    .retrieve()
                    .toEntity(String.class);
        } catch (RestClientException e) {
            log.warn("CallMeBot indisponibil pentru {}: {}", to, e.getClass().getSimpleName());
            throw new DeliveryException("Serviciul CallMeBot nu răspunde. Încercați mai târziu.");
        }
        // CallMeBot raspunde cu o pagina HTML; erorile (cheie gresita, numar neactivat) apar in text
        String body = response.getBody() == null ? "" : response.getBody().toLowerCase(Locale.ROOT);
        if (body.contains("apikey is invalid") || body.contains("invalid apikey")) {
            throw new DeliveryException("Cheia CallMeBot este greșită pentru acest număr.");
        }
        if (body.contains("error")) {
            log.warn("CallMeBot a refuzat mesajul pentru {}: {}", to, body.length() > 300 ? body.substring(0, 300) : body);
            throw new DeliveryException("CallMeBot a refuzat mesajul. Verificați numărul și cheia.");
        }
    }

    // "0744 123 456" -> "+40744123456"; null daca nu arata a numar de telefon
    static String normalizePhone(String raw) {
        if (raw == null) return null;
        String digits = raw.replaceAll("\\D", "");
        if (digits.startsWith("00")) digits = digits.substring(2);
        else if (digits.startsWith("0")) digits = "40" + digits.substring(1);
        return digits.length() >= 10 && digits.length() <= 15 ? "+" + digits : null;
    }
}
