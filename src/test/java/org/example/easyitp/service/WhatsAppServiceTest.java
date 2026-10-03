package org.example.easyitp.service;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Verifica cererea trimisa catre CallMeBot cu un server HTTP local in locul API-ului real
class WhatsAppServiceTest {

    private HttpServer server;
    private String rawQuery;
    private String responseBody = "Message queued. You will receive it in a few seconds.";

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/whatsapp.php", exchange -> {
            rawQuery = exchange.getRequestURI().getRawQuery();
            byte[] body = responseBody.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(body);
            }
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    private WhatsAppService service() {
        return new WhatsAppService("http://127.0.0.1:" + server.getAddress().getPort());
    }

    @Test
    void encodesPhoneTextAndKey() {
        service().send("0744 123 456", " key123 ", "*Programări azi*\n• 09:00 · Ion & Ana");

        Map<String, String> params = new HashMap<>();
        for (String pair : rawQuery.split("&")) {
            String[] kv = pair.split("=", 2);
            params.put(kv[0], URLDecoder.decode(kv[1], StandardCharsets.UTF_8));
        }
        // "+" trebuie codat (%2B), altfel serverul il citeste ca spatiu
        assertThat(rawQuery).contains("phone=%2B40744123456");
        assertThat(params.get("phone")).isEqualTo("+40744123456");
        assertThat(params.get("text")).isEqualTo("*Programări azi*\n• 09:00 · Ion & Ana");
        assertThat(params.get("apikey")).isEqualTo("key123");
    }

    @Test
    void reportsCallMeBotErrors() {
        responseBody = "<html>APIKey is invalid. Please check the API key.</html>";
        assertThatThrownBy(() -> service().send("0744123456", "bad", "x"))
                .isInstanceOf(DeliveryException.class)
                .hasMessageContaining("Cheia CallMeBot");

        assertThatThrownBy(() -> service().send("072", "key", "x")).hasMessageContaining("Numărul");
        assertThatThrownBy(() -> service().send("0744123456", " ", "x")).hasMessageContaining("cheia");
    }

    @Test
    void normalizesRomanianNumbers() {
        assertThat(WhatsAppService.normalizePhone("0744 123 456")).isEqualTo("+40744123456");
        assertThat(WhatsAppService.normalizePhone("+40 744 123 456")).isEqualTo("+40744123456");
        assertThat(WhatsAppService.normalizePhone("0040744123456")).isEqualTo("+40744123456");
        assertThat(WhatsAppService.normalizePhone("744")).isNull();
    }
}
