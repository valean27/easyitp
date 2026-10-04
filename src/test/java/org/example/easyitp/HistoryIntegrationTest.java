package org.example.easyitp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Appointment;
import org.example.easyitp.entity.AppointmentStatus;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.AppointmentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Istoricul modificarilor si "Anuleaza" la stergere (B2)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class HistoryIntegrationTest {

    private static final String PASSWORD = "secret12";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private AppointmentRepository appointments;
    @Autowired private PasswordEncoder encoder;

    private String manager;
    private String other;
    private AppUser managerUser;
    private final LocalDate today = LocalDate.now();

    @BeforeEach
    void setUp() throws Exception {
        managerUser = users.save(AppUser.builder().email("h1@itp.ro").password(encoder.encode(PASSWORD)).role(Role.MANAGER).build());
        users.save(AppUser.builder().email("h2@itp.ro").password(encoder.encode(PASSWORD)).role(Role.MANAGER).build());
        manager = login("h1@itp.ro");
        other = login("h2@itp.ro");
    }

    @Test
    void addsAndEditsAreLoggedWithWhatChanged() throws Exception {
        long id = createItp("Ion Pop", "CJ01HIS", today.minusDays(3), 150);
        send(put("/api/itp/" + id), itpBody("Ion Pop", "CJ01HIS", today.minusDays(3), 200)).andExpect(status().isNoContent());
        // salvarea fara schimbari nu adauga nimic
        send(put("/api/itp/" + id), itpBody("Ion Pop", "CJ01HIS", today.minusDays(3), 200)).andExpect(status().isNoContent());

        JsonNode all = getJson("/api/history", manager);
        assertThat(all.get("total").asLong()).isEqualTo(2);
        JsonNode edit = all.get("items").get(0);
        assertThat(edit.get("action").asText()).isEqualTo("UPDATE");
        assertThat(edit.get("actor").asText()).isEqualTo("h1@itp.ro");
        assertThat(edit.get("changes").asText()).isEqualTo("Preț: 150,00 → 200,00");
        assertThat(edit.get("summary").asText()).contains("CJ01HIS").contains("Ion Pop");

        assertThat(getJson("/api/history?filter=adds", manager).get("total").asLong()).isEqualTo(1);
        assertThat(getJson("/api/history", other).get("total").asLong()).isZero();
    }

    @Test
    void deletedItpComesBackWithItsCarClientAndAppointment() throws Exception {
        long id = createItp("Maria Undo", "B22UND", today.minusDays(1), 120);
        Appointment appt = appointments.save(Appointment.builder().user(managerUser).clientName("Maria Undo")
                .appointmentDate(today.atTime(9, 0)).status(AppointmentStatus.COMPLETED).itpRecordId(id).build());

        String eventId = mvc.perform(delete("/api/itp/" + id).header("Authorization", "Bearer " + manager))
                .andExpect(status().isNoContent())
                .andExpect(header().exists("X-Audit-Event"))
                .andReturn().getResponse().getHeader("X-Audit-Event");
        assertThat(getJson("/api/clients?q=maria", manager).get("total").asLong()).isZero();

        // alta statie nu poate anula
        mvc.perform(post("/api/history/" + eventId + "/undo").header("Authorization", "Bearer " + other))
                .andExpect(status().isNotFound());

        mvc.perform(post("/api/history/" + eventId + "/undo").header("Authorization", "Bearer " + manager))
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("A fost restaurat 1 ITP."));
        JsonNode history = getJson("/api/itp/history?plate=B22UND", manager);
        assertThat(history).hasSize(1);
        assertThat(history.get(0).get("numeSofer").asText()).isEqualTo("Maria Undo");
        assertThat(history.get(0).get("price").asDouble()).isEqualTo(120);
        assertThat(appointments.findById(appt.getId()).orElseThrow().getItpRecordId()).isEqualTo(history.get(0).get("id").asLong());

        // a doua anulare nu dubleaza nimic
        mvc.perform(post("/api/history/" + eventId + "/undo").header("Authorization", "Bearer " + manager))
                .andExpect(status().isConflict());
        JsonNode deletes = getJson("/api/history?filter=deletes", manager);
        assertThat(deletes.get("items").get(0).get("action").asText()).isEqualTo("RESTORE");
        assertThat(deletes.get("items").get(1).get("canUndo").asBoolean()).isFalse();
    }

    @Test
    void deletedClientComesBackWithAllCarsAndItps() throws Exception {
        createItp("Dan Flota", "CJ10DAN", today.minusYears(1), 100);
        createItp("Dan Flota", "CJ10DAN", today.minusDays(5), 100);
        createItp("Dan Flota", "CJ11DAN", today.minusDays(4), 100);
        long clientId = getJson("/api/clients?q=dan flota", manager).get("items").get(0).get("id").asLong();

        String eventId = mvc.perform(delete("/api/clients/" + clientId).header("Authorization", "Bearer " + manager))
                .andExpect(status().isNoContent()).andReturn().getResponse().getHeader("X-Audit-Event");
        assertThat(getJson("/api/history?filter=deletes", manager).get("items").get(0).get("summary").asText())
                .contains("2 mașini, 3 ITP-uri");

        mvc.perform(post("/api/history/" + eventId + "/undo").header("Authorization", "Bearer " + manager))
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("Au fost restaurate 3 ITP-uri."));
        JsonNode client = getJson("/api/clients?q=dan flota", manager).get("items").get(0);
        assertThat(client.get("vehicleCount").asInt()).isEqualTo(2);
        assertThat(getJson("/api/itp/history?plate=CJ10DAN", manager)).hasSize(2);
    }

    @Test
    void deletingAVehicleCanBeUndone() throws Exception {
        createItp("Vlad", "SV01VLD", today.minusDays(2), 100);
        createItp("Vlad", "SV02VLD", today.minusDays(1), 100);
        JsonNode detail = getJson("/api/clients/" + getJson("/api/clients?q=vlad", manager).get("items").get(0).get("id").asLong(), manager);
        long vehicleId = detail.get("vehicles").get(0).get("id").asLong();

        String eventId = mvc.perform(delete("/api/clients/vehicles/" + vehicleId).header("Authorization", "Bearer " + manager))
                .andExpect(status().isOk()).andReturn().getResponse().getHeader("X-Audit-Event");
        mvc.perform(post("/api/history/" + eventId + "/undo").header("Authorization", "Bearer " + manager)).andExpect(status().isOk());
        assertThat(getJson("/api/clients?q=vlad", manager).get("items").get(0).get("vehicleCount").asInt()).isEqualTo(2);
    }

    // ---------- ajutatoare ----------

    private String login(String email) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    private JsonNode getJson(String url, String token) throws Exception {
        String body = mvc.perform(get(url).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return json.readTree(body);
    }

    private ResultActions send(MockHttpServletRequestBuilder request, Object body) throws Exception {
        return mvc.perform(request.header("Authorization", "Bearer " + manager)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }

    private Map<String, Object> itpBody(String name, String plate, LocalDate testDate, double price) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("phone", "0722 333 444");
        body.put("brand", "Dacia");
        body.put("licensePlate", plate);
        body.put("testDate", testDate.toString());
        body.put("validityMonths", 12);
        body.put("price", price);
        return body;
    }

    private long createItp(String name, String plate, LocalDate testDate, double price) throws Exception {
        String body = send(post("/api/itp"), itpBody(name, plate, testDate, price))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asLong();
    }
}
