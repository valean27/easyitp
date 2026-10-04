package org.example.easyitp.service;

import com.sun.net.httpserver.HttpServer;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.SmsProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Cererile catre SMS Gateway (telefonul statiei) si SMSLink, cu un server HTTP local in locul celor reale
class SmsSenderTest {

    private HttpServer server;
    private String lastAuth;
    private String lastBody;
    private String lastQuery;
    private int status = 202;
    private String response = "{\"id\":\"msg-1\",\"state\":\"Pending\"}";

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            lastAuth = exchange.getRequestHeaders().getFirst("Authorization");
            lastQuery = exchange.getRequestURI().getRawQuery();
            lastBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            }
        });
        server.start();
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private SmsSender sender() {
        String base = "http://127.0.0.1:" + server.getAddress().getPort();
        return new SmsSender(base + "/sms/gateway/communicate/json.php", base);
    }

    @Test
    void stationPhoneGatewayGetsBasicAuthAndInternationalNumber() {
        AppUser station = AppUser.builder().id(1L).autoSmsProvider(SmsProvider.SMS_GATE)
                .smsGateUsername("ABCDEF").smsGatePassword("secret").build();
        assertThat(sender().send(station, "0722 111 222", "Salut")).isEqualTo("msg-1");
        assertThat(lastAuth).isEqualTo("Basic QUJDREVGOnNlY3JldA==");
        assertThat(lastBody).contains("\"phoneNumbers\":[\"+40722111222\"]").contains("\"text\":\"Salut\"").contains("\"ttl\":");

        status = 401;
        assertThatThrownBy(() -> sender().send(station, "0722 111 222", "Salut")).hasMessageContaining("parola");
    }

    @Test
    void smsLinkGetsNationalNumberAndReportsRefusals() {
        status = 200;
        response = "{\"response_type\":\"MESSAGE\",\"response_id\":1,\"message_id\":\"777\"}";
        AppUser station = AppUser.builder().id(2L).autoSmsProvider(SmsProvider.SMSLINK)
                .smslinkConnectionId("CONN").smslinkPassword("p@ss").build();
        assertThat(sender().send(station, "+40 722 111 222", "ITP CJ01 expira")).isEqualTo("777");
        String query = URLDecoder.decode(lastQuery, StandardCharsets.UTF_8);
        assertThat(query).contains("connection_id=CONN").contains("password=p@ss").contains("to=0722111222")
                .contains("message=ITP CJ01 expira");

        response = "{\"response_type\":\"ERROR\",\"response_message\":\"Credit insuficient\"}";
        assertThatThrownBy(() -> sender().send(station, "0722 111 222", "x")).hasMessageContaining("Credit insuficient");
    }

    @Test
    void landlinesAndMissingSettingsAreRefusedBeforeSending() {
        AppUser station = AppUser.builder().id(3L).autoSmsProvider(SmsProvider.SMS_GATE).build();
        assertThatThrownBy(() -> sender().send(station, "0264 111 222", "x")).hasMessageContaining("nu poate primi SMS");
        assertThatThrownBy(() -> sender().send(station, "0722 111 222", "x")).hasMessageContaining("Lipsesc");
    }
}
