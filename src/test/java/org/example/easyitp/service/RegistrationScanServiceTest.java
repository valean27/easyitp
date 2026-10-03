package org.example.easyitp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.example.easyitp.config.CarDictionary;
import org.example.easyitp.dto.RegistrationScanDTO;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// Verifica cererea catre API-ul Anthropic si interpretarea raspunsului, cu un server HTTP local
class RegistrationScanServiceTest {

    private final ObjectMapper json = new ObjectMapper();
    private HttpServer server;
    private JsonNode request;
    private String apiKeyHeader;
    private int status = 200;
    private String toolInput;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/messages", exchange -> {
            request = json.readTree(exchange.getRequestBody());
            apiKeyHeader = exchange.getRequestHeaders().getFirst("x-api-key");
            String body = status == 200
                    ? "{\"content\":[{\"type\":\"tool_use\",\"name\":\"date_talon\",\"input\":" + toolInput + "}]}"
                    : "{\"type\":\"error\",\"error\":{\"type\":\"overloaded_error\"}}";
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            }
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    private RegistrationScanService service(String apiKey) {
        CarService carService = mock(CarService.class);
        when(carService.vehicleNameParser()).thenReturn(new VehicleNameParser(CarDictionary.load()));
        return new RegistrationScanService("http://127.0.0.1:" + server.getAddress().getPort(), apiKey,
                "claude-haiku-4-5-20251001", carService);
    }

    @Test
    void sendsTheImageAndMapsTheFields() {
        toolInput = """
                {"esteTalon":true,"numarInmatriculare":"cj 12 abc","vin":"wvw zzz1kz8w123456",
                 "marca":"VOLKSWAGEN","model":"GOLF","anFabricatie":2008,"titular":"POPESCU ION"}""";

        RegistrationScanDTO result = service("key-123").scan(1L, new byte[]{1, 2, 3}, "image/jpeg");

        assertThat(apiKeyHeader).isEqualTo("key-123");
        assertThat(request.path("model").asText()).isEqualTo("claude-haiku-4-5-20251001");
        assertThat(request.path("tool_choice").path("name").asText()).isEqualTo("date_talon");
        JsonNode image = request.path("messages").get(0).path("content").get(0);
        assertThat(image.path("source").path("media_type").asText()).isEqualTo("image/jpeg");
        assertThat(image.path("source").path("data").asText()).isEqualTo("AQID");

        assertThat(result).isEqualTo(new RegistrationScanDTO(
                "CJ 12 ABC", "WVWZZZ1KZ8W123456", "Volkswagen", "Golf", 2008, "Popescu Ion", java.util.List.of()));
    }

    @Test
    void dropsAnIncompleteVinAndExplainsWhy() {
        toolInput = """
                {"esteTalon":true,"numarInmatriculare":"B 123 XYZ","vin":"UU1234","marca":"DACIA","model":"LOGAN"}""";

        RegistrationScanDTO result = service("k").scan(1L, new byte[]{1}, "image/png");

        assertThat(result.vin()).isNull();
        assertThat(result.brand()).isEqualTo("Dacia");
        assertThat(result.model()).isEqualTo("Logan");
        assertThat(result.year()).isNull();
        assertThat(result.warnings()).singleElement().asString().contains("UU1234");
    }

    @Test
    void rejectsPhotosThatAreNotARegistrationCertificate() {
        toolInput = "{\"esteTalon\":false}";
        assertThatThrownBy(() -> service("k").scan(1L, new byte[]{1}, "image/jpeg"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("nu pare să fie un talon");
    }

    @Test
    void reportsUpstreamErrorsAndMissingConfiguration() {
        status = 529;
        assertThatThrownBy(() -> service("k").scan(1L, new byte[]{1}, "image/jpeg"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("nu a putut fi citit");
        assertThatThrownBy(() -> service("").scan(1L, new byte[]{1}, "image/jpeg"))
                .hasMessageContaining("nu este configurată");
    }
}
