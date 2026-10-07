package org.example.easyitp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.service.AccountDeletionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Datele statiei la cerere (GDPR): exportul complet si stergerea contului cu 30 de zile de gratie, apoi stergerea
// definitiva a tot ce tine de statie (fara sa atinga alta statie); adminul poate anula sau sterge imediat
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AccountDeletionIntegrationTest {

    private static final String PASSWORD = "secret12";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private PasswordEncoder encoder;
    @Autowired private AccountDeletionService deletionService;
    @Autowired private JdbcTemplate jdbc;

    private AppUser station;
    private String token;
    private String otherToken;

    @BeforeEach
    void setUp() throws Exception {
        station = users.save(AppUser.builder().email("sterge@itp.ro").password(encoder.encode(PASSWORD)).role(Role.MANAGER)
                .stationName("ITP de șters").build());
        users.save(AppUser.builder().email("ramane@itp.ro").password(encoder.encode(PASSWORD)).role(Role.MANAGER).build());
        token = login("sterge@itp.ro");
        otherToken = login("ramane@itp.ro");
        fillStation(token, "CJ01DEL");
        fillStation(otherToken, "CJ02KEP");
    }

    @Test
    void exportHasAllTheDataAndNoSecrets() throws Exception {
        String res = mvc.perform(get("/api/account/export").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        JsonNode data = json.readTree(res);
        assertThat(data.get("station").get("email").asText()).isEqualTo("sterge@itp.ro");
        assertThat(data.get("clients")).hasSize(1);
        assertThat(data.get("itpRecords")).hasSize(1);
        assertThat(data.get("appointments")).hasSize(1);
        assertThat(data.get("fleets")).hasSize(1);
        assertThat(data.get("stationDeadlines")).hasSize(1);
        assertThat(data.get("history").size()).isGreaterThan(0);
        assertThat(res).doesNotContain("CJ02KEP").doesNotContain(station.getPassword()).doesNotContain("password");
    }

    @Test
    void deletionClosesTheAccountAndPurgesEverythingAfterTheGracePeriod() throws Exception {
        send(post("/api/account/delete"), token, Map.of("password", "gresita", "confirm", "STERGE")).andExpect(status().isForbidden());
        send(post("/api/account/delete"), token, Map.of("password", PASSWORD, "confirm", "da")).andExpect(status().isBadRequest());
        send(post("/api/account/delete"), token, Map.of("password", PASSWORD, "confirm", "ȘTERGE")).andExpect(status().isOk());

        // contul e inchis imediat
        mvc.perform(get("/api/itp/summary").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"sterge@itp.ro\",\"password\":\"" + PASSWORD + "\"}")).andExpect(status().isForbidden());

        Long id = station.getId();
        assertThat(deletionService.purgeDue(LocalDateTime.now())).isZero();
        assertThat(count("clients", "user_id", id)).isEqualTo(1);

        assertThat(deletionService.purgeDue(LocalDateTime.now().plusDays(31))).isEqualTo(1);
        assertThat(users.existsById(id)).isFalse();
        for (String table : List.of("clients", "appointments", "fleets", "station_deadlines", "audit_events", "inspectors")) {
            assertThat(count(table, "user_id", id)).as(table).isZero();
        }
        assertThat(jdbc.queryForObject("select count(*) from vehicles where license_plate = 'CJ01DEL'", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from app_users where email = 'flota-sterge@firma.ro'", Integer.class)).isZero();
        // cealalta statie e neatinsa
        assertThat(jdbc.queryForObject("select count(*) from vehicles where license_plate = 'CJ02KEP'", Integer.class)).isEqualTo(1);
        mvc.perform(get("/api/itp/summary").header("Authorization", "Bearer " + otherToken)).andExpect(status().isOk());
    }

    @Test
    void adminCanCancelOrDeleteRightAway() throws Exception {
        send(post("/api/account/delete"), token, Map.of("password", PASSWORD, "confirm", "sterge")).andExpect(status().isOk());
        String admin = login("admin@itp.ro", "admin-test-pass");
        send(put("/api/admin/managers/" + station.getId() + "/active"), admin, Map.of("active", true)).andExpect(status().isNoContent());
        assertThat(users.findById(station.getId()).orElseThrow().getDeletionRequestedAt()).isNull();
        login("sterge@itp.ro");

        // fara force, o statie cu date nu se sterge; cu force da
        mvc.perform(delete("/api/admin/managers/" + station.getId()).header("Authorization", "Bearer " + admin))
                .andExpect(status().isConflict());
        mvc.perform(delete("/api/admin/managers/" + station.getId()).param("force", "true").header("Authorization", "Bearer " + admin))
                .andExpect(status().isNoContent());
        assertThat(users.existsById(station.getId())).isFalse();
    }

    private void fillStation(String t, String plate) throws Exception {
        Map<String, Object> itp = new LinkedHashMap<>();
        itp.put("name", "Client " + plate);
        itp.put("phone", "0722 000 001");
        itp.put("brand", "Dacia");
        itp.put("licensePlate", plate);
        itp.put("testDate", LocalDate.now().toString());
        itp.put("validityMonths", 12);
        itp.put("price", 150.0);
        send(post("/api/itp"), t, itp).andExpect(status().isCreated());
        send(post("/api/appointments"), t, Map.of("clientName", "Ion", "licensePlate", plate,
                "appointmentDate", LocalDate.now().plusDays(1) + "T10:00:00")).andExpect(status().isCreated());
        String fleet = send(post("/api/fleets"), t, Map.of("name", "Firma " + plate, "plates", List.of(plate)))
                .andExpect(status().is2xxSuccessful()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        long fleetId = json.readTree(fleet).get("id").asLong();
        String fleetEmail = plate.equals("CJ01DEL") ? "flota-sterge@firma.ro" : "flota-ramane@firma.ro";
        send(put("/api/fleets/" + fleetId + "/account"), t, Map.of("email", fleetEmail, "password", "parola99"))
                .andExpect(status().is2xxSuccessful());
        send(post("/api/station-deadlines"), t, Map.of("kind", "AUTORIZATIE_RAR", "title", "Autorizație",
                "dueDate", LocalDate.now().plusDays(90).toString())).andExpect(status().isCreated());
        send(put("/api/account/inspectors"), t, List.of("Andrei")).andExpect(status().isOk());
    }

    private int count(String table, String column, Long id) {
        return jdbc.queryForObject("select count(*) from " + table + " where " + column + " = ?", Integer.class, id);
    }

    private ResultActions send(MockHttpServletRequestBuilder req, String t, Object body) throws Exception {
        return mvc.perform(req.header("Authorization", "Bearer " + t).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)));
    }

    private String login(String email) throws Exception {
        return login(email, PASSWORD);
    }

    private String login(String email, String password) throws Exception {
        String res = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(res).get("token").asText();
    }
}
