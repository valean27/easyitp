package org.example.easyitp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.ClientRepository;
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
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Acordul pentru remindere (C1): bifa din formular, link-ul STOP, marcajul din fisa clientului
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ConsentIntegrationTest {

    private static final String PASSWORD = "secret12";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private ClientRepository clients;
    @Autowired private PasswordEncoder encoder;

    private String manager;
    // expira peste 10 zile -> apare in "De contactat"
    private final LocalDate testDate = LocalDate.now().minusMonths(12).plusDays(10);

    @BeforeEach
    void setUp() throws Exception {
        users.save(AppUser.builder().email("g1@itp.ro").password(encoder.encode(PASSWORD)).role(Role.MANAGER)
                .stationName("ITP Acord").bookingEnabled(true).bookingSlug("itp-acord").build());
        manager = login("g1@itp.ro");
    }

    @Test
    void formCheckboxRecordsConsentAndUncheckingWithdrawsIt() throws Exception {
        createItp("Ana Acord", "CJ01ACD", Map.of("reminderConsent", true));
        JsonNode reminder = reminder("CJ01ACD");
        assertThat(reminder.get("consent").asText()).isEqualTo("GIVEN");
        assertThat(reminder.get("stopToken").asText()).hasSizeGreaterThanOrEqualTo(20);

        JsonNode client = clientFile("Ana Acord");
        assertThat(client.get("consentSource").asText()).isEqualTo("Formular ITP");

        // un ITP fara bifa (camp lipsa) nu schimba nimic; debifat explicit retrage acordul
        createItp("Ana Acord", "CJ01ACD", Map.of());
        assertThat(reminder("CJ01ACD").get("consent").asText()).isEqualTo("GIVEN");
        createItp("Ana Acord", "CJ01ACD", Map.of("reminderConsent", false));
        assertThat(reminder("CJ01ACD").get("consent").isNull()).isTrue();
    }

    @Test
    void stopLinkHidesTheClientFromRemindersWithoutLogin() throws Exception {
        createItp("Dan Stop", "CJ02STP", Map.of("reminderConsent", true));
        String token = reminder("CJ02STP").get("stopToken").asText();

        mvc.perform(get("/api/public/stop/" + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stationName").value("ITP Acord"))
                .andExpect(jsonPath("$.stopped").value(false));
        mvc.perform(post("/api/public/stop/" + token)).andExpect(status().isOk()).andExpect(jsonPath("$.stopped").value(true));
        mvc.perform(get("/api/public/stop/nu-exista-acest-token")).andExpect(status().isNotFound());

        assertThat(reminder("CJ02STP")).isNull();
        JsonNode history = getJson("/api/history?filter=changes").get("items").get(0);
        assertThat(history.get("actor").asText()).isEqualTo("client (link STOP)");
        assertThat(history.get("changes").asText()).isEqualTo("Acord remindere: de acord → nu dorește mesaje");

        // debifarea nu anuleaza un "nu doresc mesaje"; doar bifa (acord dat din nou) il readuce
        createItp("Dan Stop", "CJ02STP", Map.of("reminderConsent", false));
        assertThat(reminder("CJ02STP")).isNull();
        createItp("Dan Stop", "CJ02STP", Map.of("reminderConsent", true));
        assertThat(reminder("CJ02STP").get("consent").asText()).isEqualTo("GIVEN");
    }

    @Test
    void stationCanMarkConsentInTheClientFile() throws Exception {
        createItp("Vasile Telefon", "CJ03TEL", Map.of());
        long id = clientFile("Vasile Telefon").get("id").asLong();
        assertThat(reminder("CJ03TEL").get("consent").isNull()).isTrue();

        send(put("/api/clients/" + id + "/consent"), Map.of("consent", "DECLINED"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.consent").value("DECLINED"))
                .andExpect(jsonPath("$.consentSource").value("Stație"));
        assertThat(reminder("CJ03TEL")).isNull();
        Map<String, Object> unknown = new HashMap<>();
        unknown.put("consent", null);
        send(put("/api/clients/" + id + "/consent"), unknown).andExpect(status().isOk());
        assertThat(reminder("CJ03TEL")).isNotNull();
    }

    @Test
    void onlineBookingConsentIsKeptOnTheAppointment() throws Exception {
        LocalDate day = LocalDate.now().plusDays(1);
        while (day.getDayOfWeek().getValue() > 5 || org.example.easyitp.service.RomanianHolidays.nameOf(day) != null) day = day.plusDays(1);
        JsonNode slots = json.readTree(mvc.perform(get("/api/public/stations/itp-acord/slots?date=" + day + "&category=CAR"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        Map<String, Object> booking = Map.of("clientName", "Maria Online", "phone", "0722 555 666",
                "licensePlate", "CJ04ONL", "appointmentDate", day + "T" + slots.get(0).asText(),
                "vehicleCategory", "CAR", "reminderConsent", true);
        mvc.perform(post("/api/public/stations/itp-acord/appointments").contentType(MediaType.APPLICATION_JSON)
                .header("CF-Connecting-IP", "10.9.9.9").content(json.writeValueAsString(booking))).andExpect(status().isCreated());

        JsonNode appts = getJson("/api/appointments?start=" + day + "T00:00&end=" + day.plusDays(1) + "T00:00");
        assertThat(appts.get(0).get("reminderConsent").asBoolean()).isTrue();
        long apptId = appts.get(0).get("id").asLong();

        createItp("Maria Online", "CJ04ONL", Map.of("reminderConsent", true, "appointmentId", apptId));
        assertThat(clientFile("Maria Online").get("consentSource").asText()).isEqualTo("Programare online");
        assertThat(clients.findAll()).anyMatch(c -> c.getOptOutToken() != null && "Maria Online".equals(c.getName()));
    }

    // ---------- ajutatoare ----------

    private JsonNode reminder(String plate) throws Exception {
        for (JsonNode r : getJson("/api/reminders")) if (r.get("numarInmatriculare").asText().equals(plate)) return r;
        return null;
    }

    private JsonNode clientFile(String name) throws Exception {
        long id = getJson("/api/clients?q=" + name).get("items").get(0).get("id").asLong();
        return getJson("/api/clients/" + id);
    }

    private String login(String email) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    private JsonNode getJson(String url) throws Exception {
        String body = mvc.perform(get(url).header("Authorization", "Bearer " + manager))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return json.readTree(body);
    }

    private ResultActions send(MockHttpServletRequestBuilder request, Object body) throws Exception {
        return mvc.perform(request.header("Authorization", "Bearer " + manager)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }

    // Fiecare apel adauga un ITP nou pe acelasi numar (alta data), ca sa treaca prin formular
    private int itpCount = 0;

    private void createItp(String name, String plate, Map<String, Object> extra) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("phone", "0722 555 666");
        body.put("brand", "Dacia");
        body.put("licensePlate", plate);
        body.put("testDate", testDate.plusDays(itpCount++).toString());
        body.put("validityMonths", 12);
        body.putAll(extra);
        send(post("/api/itp"), body).andExpect(status().isCreated());
    }
}
