package org.example.easyitp.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;
import java.util.Map;

// Trimite emailuri prin API-ul Resend (https://resend.com/docs/api-reference/emails/send-email)
@Service
@Slf4j
public class EmailService {

    private final RestClient client;
    private final String apiKey;
    private final String from;

    public EmailService(@Value("${resend.api-key:}") String apiKey,
                        @Value("${mail.from:EasyITP <onboarding@resend.dev>}") String from) {
        this.apiKey = apiKey;
        this.from = from;
        this.client = RestClient.builder().baseUrl("https://api.resend.com").build();
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public void send(String to, String subject, String html) {
        if (!isConfigured()) {
            throw new EmailException("Trimiterea de emailuri nu este configurată (lipsește RESEND_API_KEY).");
        }
        try {
            client.post()
                    .uri("/emails")
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("from", from, "to", List.of(to), "subject", subject, "html", html))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            log.warn("Resend a refuzat emailul catre {}: {} {}", to, e.getStatusCode(), e.getResponseBodyAsString());
            throw new EmailException(explain(e));
        }
    }

    // Mesaje pe intelesul managerului pentru erorile frecvente de la Resend
    private static String explain(RestClientResponseException e) {
        String body = e.getResponseBodyAsString();
        if (body.contains("only send testing emails to your own email")
                || body.contains("verify a domain")) {
            return "Resend trimite deocamdată doar către adresa contului Resend. "
                    + "Pentru alte adrese trebuie verificat un domeniu în Resend.";
        }
        if (e.getStatusCode().value() == 401 || e.getStatusCode().value() == 403) {
            return "Cheia Resend (RESEND_API_KEY) este invalidă sau nu are drept de trimitere.";
        }
        if (e.getStatusCode().value() == 429) {
            return "Limita de emailuri Resend a fost atinsă. Încercați mai târziu.";
        }
        return "Emailul nu a putut fi trimis (Resend " + e.getStatusCode().value() + ").";
    }

    public static class EmailException extends RuntimeException {
        public EmailException(String message) {
            super(message);
        }
    }
}
