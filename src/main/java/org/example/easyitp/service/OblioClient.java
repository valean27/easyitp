package org.example.easyitp.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

// API-ul Oblio (oblio.eu/api): token din emailul contului + cheia API (o ora), firmele, seriile, cotele de TVA,
// emiterea unei facturi si trimiterea ei in SPV (e-Factura). Cheia fiecarei statii e a ei; nu pleaca spre interfata.
@Component
@Slf4j
public class OblioClient {

    private final RestClient client;
    // (email + cheie) -> token: o cheie gresita nu foloseste niciodata tokenul obtinut cu cea buna;
    // se reinnoieste cu un minut inainte sa expire
    private final Map<String, Token> tokens = new ConcurrentHashMap<>();

    private record Token(String value, Instant expiresAt) {
    }

    public record Company(String cif, String name) {
    }

    public record VatRate(String name, double percent) {
    }

    public record Issued(String seriesName, String number, String link) {
    }

    public OblioClient(@Value("${oblio.url:https://www.oblio.eu/api}") String baseUrl) {
        this.client = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(new BufferingClientHttpRequestFactory(
                        HttpTimeouts.factory(Duration.ofSeconds(10), Duration.ofSeconds(40))))
                .build();
    }

    public List<Company> companies(String email, String secret) {
        JsonNode data = get(email, secret, "/nomenclature/companies");
        List<Company> out = new ArrayList<>();
        for (JsonNode c : data) out.add(new Company(c.path("cif").asText(), c.path("company").asText(c.path("name").asText())));
        return out;
    }

    public List<String> series(String email, String secret, String cif) {
        JsonNode data = get(email, secret, "/nomenclature/series?cif=" + cif);
        List<String> out = new ArrayList<>();
        for (JsonNode s : data) {
            // doar seriile de facturi
            String type = s.path("type").asText("Factura");
            if (type.toLowerCase().startsWith("factur")) out.add(s.path("name").asText());
        }
        return out;
    }

    public List<VatRate> vatRates(String email, String secret, String cif) {
        JsonNode data = get(email, secret, "/nomenclature/vat_rates?cif=" + cif);
        List<VatRate> out = new ArrayList<>();
        for (JsonNode v : data) out.add(new VatRate(v.path("name").asText(), v.path("percent").asDouble()));
        return out;
    }

    public Issued createInvoice(String email, String secret, Map<String, Object> invoice) {
        JsonNode data = call(email, secret, token -> client.post().uri("/docs/invoice")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body(invoice)
                .retrieve().body(JsonNode.class));
        return new Issued(data.path("seriesName").asText(), data.path("number").asText(), data.path("link").asText(null));
    }

    // Trimite factura in SPV; intoarce mesajul Oblio (ex. "Factura a fost trimisa")
    public String sendEinvoice(String email, String secret, String cif, String seriesName, String number) {
        JsonNode data = call(email, secret, token -> client.post().uri("/docs/einvoice")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("cif", cif, "seriesName", seriesName, "number", number))
                .retrieve().body(JsonNode.class));
        return data.path("text").asText(data.path("message").asText("Trimisă în SPV"));
    }

    // ---------- ajutatoare ----------

    private JsonNode get(String email, String secret, String path) {
        return call(email, secret, token -> client.get().uri(path)
                .header("Authorization", "Bearer " + token)
                .retrieve().body(JsonNode.class));
    }

    // Raspunsul Oblio: {"status":200,"statusMessage":"Success","data":...}; altfel mesajul lor ajunge la statie
    private JsonNode call(String email, String secret, Function<String, JsonNode> request) {
        try {
            JsonNode body = request.apply(token(email, secret));
            if (body == null) throw new DeliveryException("Oblio nu a răspuns.");
            if (body.path("status").asInt(200) != 200) throw new DeliveryException("Oblio: " + body.path("statusMessage").asText("eroare"));
            return body.path("data");
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == 401) tokens.remove(cacheKey(email, secret));
            throw new DeliveryException("Oblio: " + message(e));
        } catch (RestClientException e) {
            log.warn("Oblio: {}", e.getMessage());
            throw new DeliveryException("Oblio nu a răspuns. Încercați din nou.");
        }
    }

    private String token(String email, String secret) {
        String key = cacheKey(email, secret);
        Token cached = tokens.get(key);
        if (cached != null && cached.expiresAt().isAfter(Instant.now())) return cached.value();
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", email);
        form.add("client_secret", secret);
        try {
            JsonNode body = client.post().uri("/authorize/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve().body(JsonNode.class);
            String value = body == null ? null : body.path("access_token").asText(null);
            if (value == null) throw new DeliveryException("Oblio nu a dat acces. Verificați emailul și cheia API.");
            long seconds = body.path("expires_in").asLong(3600);
            tokens.put(key, new Token(value, Instant.now().plusSeconds(Math.max(60, seconds - 60))));
            return value;
        } catch (RestClientResponseException e) {
            throw new DeliveryException("Oblio nu a acceptat emailul sau cheia API.");
        } catch (RestClientException e) {
            throw new DeliveryException("Oblio nu a răspuns. Încercați din nou.");
        }
    }

    private static String cacheKey(String email, String secret) {
        try {
            byte[] hash = java.security.MessageDigest.getInstance("SHA-256")
                    .digest((email.toLowerCase(java.util.Locale.ROOT) + "\n" + secret).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(hash);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String message(RestClientResponseException e) {
        try {
            JsonNode body = new com.fasterxml.jackson.databind.ObjectMapper().readTree(e.getResponseBodyAsString());
            String msg = body.path("statusMessage").asText(null);
            if (msg != null && !msg.isBlank()) return msg;
        } catch (Exception ignored) {
            // corp care nu e JSON
        }
        return "eroare " + e.getStatusCode().value();
    }
}
