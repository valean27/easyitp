package org.example.easyitp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.service.GooglePlacesService;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Nota de pe Google: cautarea locului, alegerea lui, nota in lista publica si reimprospatarea zilnica.
// Google Places e inlocuit de un server local.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class GoogleRatingIntegrationTest {

    private static final String PASSWORD = "secret12";
    private static final List<String> CALLS = new CopyOnWriteArrayList<>();
    private static volatile double rating = 4.6;
    private static final HttpServer SERVER;

    static {
        try {
            SERVER = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            SERVER.createContext("/", exchange -> {
                CALLS.add(exchange.getRequestMethod() + " " + exchange.getRequestURI().getPath() + " key="
                        + exchange.getRequestHeaders().getFirst("X-Goog-Api-Key"));
                String place = "{\"id\":\"ChIJplaceIdExemplu\",\"displayName\":{\"text\":\"ITP Exemplu\"},"
                        + "\"formattedAddress\":\"Str. Fabricii 12, Cluj-Napoca\",\"rating\":" + rating
                        + ",\"userRatingCount\":128,\"googleMapsUri\":\"https://maps.google.com/?cid=123\"}";
                String json = exchange.getRequestURI().getPath().endsWith(":searchText") ? "{\"places\":[" + place + "]}" : place;
                byte[] body = json.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                try (OutputStream out = exchange.getResponseBody()) {
                    out.write(body);
                }
            });
            SERVER.start();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("google.places.url", () -> "http://127.0.0.1:" + SERVER.getAddress().getPort() + "/v1");
        r.add("google.places.api-key", () -> "test-key");
    }

    @AfterAll
    static void stop() {
        SERVER.stop(0);
    }

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private PasswordEncoder encoder;
    @Autowired private GooglePlacesService googlePlacesService;

    @Test
    void stationPicksItsPlaceAndTheRatingShowsInThePublicList() throws Exception {
        AppUser station = users.save(AppUser.builder().email("g1@itp.ro").password(encoder.encode(PASSWORD)).role(Role.MANAGER)
                .stationName("ITP Exemplu").bookingEnabled(true).bookingSlug("itp-exemplu").build());
        String token = login();

        mvc.perform(get("/api/account/visibility").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.googleAvailable").value(true))
                .andExpect(jsonPath("$.googlePlaceId").doesNotExist());
        mvc.perform(get("/api/account/google-place/search").param("q", "ITP Exemplu Cluj").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("ChIJplaceIdExemplu"))
                .andExpect(jsonPath("$[0].rating").value(4.6));
        assertThat(CALLS).anyMatch(c -> c.equals("POST /v1/places:searchText key=test-key"));

        mvc.perform(put("/api/account/google-place").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("placeId", "bad id!"))))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/account/google-place").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("placeId", "ChIJplaceIdExemplu"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.googleRating").value(4.6))
                .andExpect(jsonPath("$.googleRatingCount").value(128))
                // fara link de harta: il ia pe cel de pe Google
                .andExpect(jsonPath("$.mapsUrl").value("https://maps.google.com/?cid=123"));

        mvc.perform(get("/api/public/stations"))
                .andExpect(jsonPath("$[0].googleRating").value(4.6))
                .andExpect(jsonPath("$[0].googleRatingCount").value(128));

        // reimprospatarea: doar notele mai vechi de 3 zile
        rating = 4.8;
        assertThat(googlePlacesService.refreshAll(LocalDateTime.now())).isZero();
        assertThat(googlePlacesService.refreshAll(LocalDateTime.now().plusDays(4))).isEqualTo(1);
        assertThat(users.findById(station.getId()).orElseThrow().getGoogleRating()).isEqualTo(4.8);

        mvc.perform(delete("/api/account/google-place").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.googleRating").doesNotExist());
        mvc.perform(get("/api/public/stations")).andExpect(jsonPath("$[0].googleRating").doesNotExist());
        rating = 4.6;
    }

    @Test
    void driversSearchItpStationsInTheirCityAndOurStationsGetABookingLink() throws Exception {
        users.save(AppUser.builder().email("g2@itp.ro").password(encoder.encode(PASSWORD)).role(Role.MANAGER)
                .stationName("ITP Exemplu").bookingEnabled(true).bookingSlug("itp-exemplu-2")
                .googlePlaceId("ChIJplaceIdExemplu").build());

        mvc.perform(get("/api/public/nearby-stations/available")).andExpect(jsonPath("$.available").value(true));
        mvc.perform(get("/api/public/nearby-stations").param("city", "x")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/public/nearby-stations").param("city", "Cluj<script>")).andExpect(status().isBadRequest());

        mvc.perform(get("/api/public/nearby-stations").param("city", "Cluj-Napoca"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("ITP Exemplu"))
                .andExpect(jsonPath("$[0].rating").value(4.6))
                .andExpect(jsonPath("$[0].mapsUrl").value("https://maps.google.com/?cid=123"))
                .andExpect(jsonPath("$[0].slug").value("itp-exemplu-2"));
    }

    private String login() throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"g1@itp.ro\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }
}
