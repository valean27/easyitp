package org.example.easyitp.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Trimite emailuri prin API-ul Resend (https://resend.com/docs/api-reference/emails/send-email)
@Service
@Slf4j
public class EmailService {

    private static final int MAX_ATTEMPTS = 2;
    private static final long RETRY_PAUSE_MS = 2000;

    private final RestClient client;
    private final String apiKey;
    private final String from;

    public EmailService(@Value("${resend.api-key:}") String apiKey,
                        @Value("${mail.from:EasyITP <onboarding@resend.dev>}") String from) {
        this.apiKey = apiKey;
        this.from = from;
        this.client = RestClient.builder().baseUrl("https://api.resend.com")
                .requestFactory(HttpTimeouts.factory(Duration.ofSeconds(10), Duration.ofSeconds(20))).build();
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public void send(String to, String subject, String html) {
        if (!isConfigured()) {
            throw new DeliveryException("Trimiterea de emailuri nu este configurată (lipsește RESEND_API_KEY).");
        }
        // Aceeasi cheie la reincercare: Resend nu trimite de doua ori daca prima cerere a ajuns totusi
        String idempotencyKey = UUID.randomUUID().toString();
        for (int attempt = 1; ; attempt++) {
            try {
                post(to, subject, html, idempotencyKey);
                return;
            } catch (RestClientResponseException e) {
                if (e.getStatusCode().is5xxServerError() && attempt < MAX_ATTEMPTS) {
                    pause();
                    continue;
                }
                log.warn("Resend a refuzat emailul catre {}: {} {}", to, e.getStatusCode(), e.getResponseBodyAsString());
                throw new DeliveryException(explain(e));
            } catch (RestClientException e) {
                if (attempt < MAX_ATTEMPTS) {
                    pause();
                    continue;
                }
                log.warn("Resend indisponibil pentru {}: {}", to, e.getClass().getSimpleName());
                throw new DeliveryException("Serviciul de email nu răspunde. Încercați mai târziu.");
            }
        }
    }

    private void post(String to, String subject, String html, String idempotencyKey) {
        client.post()
                .uri("/emails")
                .header("Authorization", "Bearer " + apiKey)
                .header("Idempotency-Key", idempotencyKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("from", from, "to", List.of(to), "subject", subject, "html", html))
                .retrieve()
                .toBodilessEntity();
    }

    private static void pause() {
        try {
            Thread.sleep(RETRY_PAUSE_MS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
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

}
