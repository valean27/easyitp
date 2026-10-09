package org.example.easyitp.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

// API-ul FGO (api.fgo.ro/v1, documentatia v7): cereri JSON cu CodUnic (CUI-ul firmei), Hash si PlatformaUrl.
// Hash = SHA-1 (litere mari) din CUI + cheia privata + denumirea clientului (emitere) sau numarul facturii (restul).
// Limita FGO: o factura pe secunda, raspuns in cel mult 15 secunde.
@Component
public class FgoClient {

    public static final String PRODUCTION = "https://api.fgo.ro/v1";
    public static final String TEST = "https://api-testuat.fgo.ro/v1";

    public record Issued(String series, String number, String link) {
    }

    private static final com.fasterxml.jackson.databind.ObjectMapper JSON = new com.fasterxml.jackson.databind.ObjectMapper();
    private final RestClient.Builder builder;

    // Clientul HTTP din JDK: la erori FGO intoarce HTTP 500 cu mesajul in corp, iar HttpURLConnection ar arunca
    // o exceptie inainte sa-l putem citi
    public FgoClient() {
        this(RestClient.builder().requestFactory(jdkFactory()));
    }

    private static org.springframework.http.client.JdkClientHttpRequestFactory jdkFactory() {
        var factory = new org.springframework.http.client.JdkClientHttpRequestFactory(
                java.net.http.HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build());
        factory.setReadTimeout(Duration.ofSeconds(30));
        return factory;
    }

    // pentru teste (MockRestServiceServer)
    FgoClient(RestClient.Builder builder) {
        this.builder = builder;
    }

    public static String hash(String cui, String privateKey, String data) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-1").digest((cui + privateKey + data).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().withUpperCase().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    // body: campurile facturii (Serie, Client, Continut ...); aici se adauga autentificarea
    public Issued issue(String baseUrl, String cui, String privateKey, String platformUrl, Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        Map<String, Object> client = (Map<String, Object>) body.get("Client");
        Map<String, Object> request = auth(cui, hash(cui, privateKey, String.valueOf(client.get("Denumire"))), platformUrl);
        request.putAll(body);
        JsonNode factura = post(baseUrl, "/factura/emitere", request).path("Factura");
        return new Issued(factura.path("Serie").asText(), factura.path("Numar").asText(), factura.path("Link").asText(null));
    }

    // Incasarea facturii (FGO Premium / Enterprise)
    public void markPaid(String baseUrl, String cui, String privateKey, String platformUrl, Issued invoice, String paymentType,
                         String amount, String paidAt) {
        Map<String, Object> request = auth(cui, hash(cui, privateKey, invoice.number()), platformUrl);
        request.put("NumarFactura", invoice.number());
        request.put("SerieFactura", invoice.series());
        request.put("TipIncasare", paymentType);
        request.put("SumaIncasata", amount);
        request.put("DataIncasare", paidAt);
        post(baseUrl, "/factura/incasare", request);
    }

    // Proba din admin: starea unei facturi inexistente. Cu date gresite FGO raspunde cu eroare de autentificare,
    // cu date bune spune ca factura nu exista. Intoarce mesajul FGO, ca adminul sa vada exact ce s-a intamplat.
    public String probe(String baseUrl, String cui, String privateKey, String platformUrl, String series) {
        Map<String, Object> request = auth(cui, hash(cui, privateKey, "0"), platformUrl);
        request.put("Numar", "0");
        request.put("Serie", series);
        try {
            JsonNode res = call(baseUrl, "/factura/getstatus", request);
            return res.path("Success").asBoolean() ? "OK" : cleanMessage(res.path("Message").asText(null));
        } catch (RestClientException e) {
            throw new DeliveryException("FGO nu răspunde: " + e.getMessage());
        }
    }

    private static Map<String, Object> auth(String cui, String hash, String platformUrl) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("CodUnic", cui);
        m.put("Hash", hash);
        m.put("PlatformaUrl", platformUrl);
        return m;
    }

    private JsonNode post(String baseUrl, String path, Map<String, Object> request) {
        JsonNode res;
        try {
            res = call(baseUrl, path, request);
        } catch (RestClientException e) {
            throw new DeliveryException("FGO nu răspunde: " + e.getMessage());
        }
        if (res == null || !res.path("Success").asBoolean(false)) {
            String message = res == null ? "răspuns gol" : cleanMessage(res.path("Message").asText(null));
            throw new DeliveryException("FGO: " + message);
        }
        return res;
    }

    // FGO raspunde la erori cu HTTP 500 si acelasi corp JSON ({"Success":false,"Message":...}): il citim oricare ar fi codul
    private JsonNode call(String baseUrl, String path, Map<String, Object> request) {
        return builder.build().post().uri(baseUrl + path)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(request)
                .exchange((req, res) -> {
                    byte[] raw = res.getBody().readAllBytes();
                    try {
                        return JSON.readTree(raw);
                    } catch (java.io.IOException e) {
                        throw new DeliveryException("FGO a răspuns " + res.getStatusCode().value() + " fără JSON");
                    }
                });
    }

    // "System.Exception: Codul unic nu exista sau nu este asociat.\r\n   at Fgo..." -> "Codul unic nu exista sau nu este asociat."
    static String cleanMessage(String message) {
        if (message == null || message.isBlank()) return "eroare necunoscută";
        String first = message.split("\\r?\\n")[0].trim();
        first = first.replaceFirst("^[A-Za-z.]*Exception:\\s*", "");
        return first.length() > 250 ? first.substring(0, 250) + "…" : first;
    }
}
