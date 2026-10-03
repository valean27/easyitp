package org.example.easyitp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Portalul pentru flote: managerul aloca numere unei firme, firma isi vede doar masinile ei
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class FleetIntegrationTest {

    private static final String PASSWORD = "secret12";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private PasswordEncoder encoder;

    private String manager;
    private String otherManager;

    @BeforeEach
    void setUp() throws Exception {
        users.save(AppUser.builder().email("statie@itp.ro").password(encoder.encode(PASSWORD)).role(Role.MANAGER)
                .stationName("ITP Cluj").phone("0264 000 000").build());
        users.save(AppUser.builder().email("alta@itp.ro").password(encoder.encode(PASSWORD)).role(Role.MANAGER).build());
        manager = login("statie@itp.ro", PASSWORD);
        otherManager = login("alta@itp.ro", PASSWORD);
    }

    @Test
    void fleetSeesOnlyItsVehiclesAndMonthlyStatement() throws Exception {
        LocalDate today = LocalDate.now();
        LocalDate lastMonth = today.minusMonths(1).withDayOfMonth(10);
        createItp("CJ 01 FAN", lastMonth, 12, 150.0);            // al firmei, valabil
        createItp("CJ02FAN", today.minusMonths(12).plusDays(10), 12, 140.0); // al firmei, expira in ~10 zile
        createItp("CJ 03 ALT", lastMonth, 12, 999.0);             // alt client al statiei

        long fleetId = json.readTree(send(post("/api/fleets"), manager, Map.of(
                        "name", "Fan Courier Cluj", "cui", "RO123",
                        "plates", List.of("cj 01 fan", "CJ-02-FAN", "CJ01FAN", "B 99 NOU")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();

        JsonNode fleets = getJson("/api/fleets", manager);
        assertThat(fleets).hasSize(1);
        assertThat(fleets.get(0).get("vehicleCount").asInt()).isEqualTo(3); // dublura CJ01FAN eliminata
        assertThat(fleets.get(0).get("expiringCount").asInt()).isEqualTo(1);

        // contul firmei
        send(put("/api/fleets/" + fleetId + "/account"), manager, Map.of("email", "flota@fan.ro", "password", "123"))
                .andExpect(status().isBadRequest());
        send(put("/api/fleets/" + fleetId + "/account"), manager, Map.of("email", "statie@itp.ro", "password", "parola99"))
                .andExpect(status().isConflict());
        send(put("/api/fleets/" + fleetId + "/account"), manager, Map.of("email", "Flota@Fan.ro", "password", "parola99"))
                .andExpect(status().isOk());
        String fleet = login("flota@fan.ro", "parola99");

        JsonNode overview = getJson("/api/fleet-portal", fleet);
        assertThat(overview.get("fleetName").asText()).isEqualTo("Fan Courier Cluj");
        assertThat(overview.get("stationPhone").asText()).isEqualTo("0264 000 000");
        JsonNode vehicles = overview.get("vehicles");
        assertThat(vehicles).hasSize(3);
        assertThat(vehicles.get(0).get("plate").asText()).isEqualTo("CJ02FAN"); // expira primul, scris ca in fisa ITP
        assertThat(vehicles.get(0).get("daysLeft").asLong()).isBetween(8L, 11L);
        assertThat(vehicles.get(2).get("plate").asText()).isEqualTo("B 99 NOU");  // fara ITP la statie
        assertThat(vehicles.get(2).get("nextItpDate").isNull()).isTrue();
        assertThat(overview.toString()).doesNotContain("CJ 03 ALT");

        JsonNode statement = getJson("/api/fleet-portal/statement?month=" + YearMonth.from(lastMonth), fleet);
        assertThat(statement.get("rows")).hasSize(1);
        assertThat(statement.get("rows").get(0).get("plate").asText()).isEqualTo("CJ 01 FAN");
        assertThat(statement.get("total").asDouble()).isEqualTo(150.0);
        assertThat(statement.get("cui").asText()).isEqualTo("RO123");

        // firma nu vede nimic din aplicatia statiei, iar statia nu intra in portal
        mvc.perform(get("/api/itp/dashboard").header("Authorization", "Bearer " + fleet)).andExpect(status().isForbidden());
        mvc.perform(get("/api/fleets").header("Authorization", "Bearer " + fleet)).andExpect(status().isForbidden());
        mvc.perform(get("/api/fleet-portal").header("Authorization", "Bearer " + manager)).andExpect(status().isForbidden());
        // alta statie nu vede firma
        mvc.perform(get("/api/fleets/" + fleetId).header("Authorization", "Bearer " + otherManager)).andExpect(status().isNotFound());
        assertThat(getJson("/api/fleets", otherManager)).isEmpty();

        // firma isi poate schimba parola
        send(put("/api/account/password"), fleet, Map.of("currentPassword", "parola99", "newPassword", "parola100"))
                .andExpect(status().isNoContent());

        // stergerea firmei sterge si contul ei
        mvc.perform(delete("/api/fleets/" + fleetId).header("Authorization", "Bearer " + manager)).andExpect(status().isNoContent());
        assertThat(users.findByEmail("flota@fan.ro")).isEmpty();
    }

    @Test
    void validatesFleetData() throws Exception {
        send(post("/api/fleets"), manager, Map.of("name", " ")).andExpect(status().isBadRequest());
        send(post("/api/fleets"), manager, Map.of("name", "Scoala Auto", "plates", List.of("CJ 123456789 ABCDEF")))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/fleets/1/statement?month=septembrie").header("Authorization", "Bearer " + manager))
                .andExpect(status().is4xxClientError());
    }

    // ---------- helpers ----------

    private void createItp(String plate, LocalDate testDate, int months, double price) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", "Sofer " + plate);
        body.put("brand", "Dacia");
        body.put("model", "Logan");
        body.put("licensePlate", plate);
        body.put("testDate", testDate.toString());
        body.put("validityMonths", months);
        body.put("price", price);
        send(post("/api/itp"), manager, body).andExpect(status().isCreated());
    }

    private ResultActions send(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,
                               String token, Map<String, ?> body) throws Exception {
        return mvc.perform(request.header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)));
    }

    private String login(String email, String password) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", email, "password", password))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    private JsonNode getJson(String url, String token) throws Exception {
        return json.readTree(mvc.perform(get(url).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }
}
