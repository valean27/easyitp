package org.example.easyitp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
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
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Programarea online de pe pagina publica
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class BookingIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private AppointmentRepository appointments;
    @Autowired private PasswordEncoder encoder;

    private String token;
    // Limita pe IP e comuna tuturor testelor, asa ca fiecare test foloseste alt IP
    private String ip;
    private final LocalDate day = LocalDate.now().plusDays(3);

    @BeforeEach
    void setUp() throws Exception {
        users.save(AppUser.builder().email("statie@itp.ro").password(encoder.encode("secret12"))
                .role(Role.MANAGER).stationName("ITP Șoseaua Cluj-Napoca").build());
        token = json.readTree(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"statie@itp.ro\",\"password\":\"secret12\"}"))
                .andReturn().getResponse().getContentAsString()).get("token").asText();
        ip = "10.0." + (int) (Math.random() * 250) + "." + (int) (Math.random() * 250);
    }

    @Test
    void stationIsPrivateUntilBookingIsEnabled() throws Exception {
        enableBooking("", 1);
        String slug = settings().get("slug").asText();
        assertThat(slug).isEqualTo("itp-soseaua-cluj-napoca");
        mvc.perform(get("/api/public/stations/" + slug)).andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("ITP Șoseaua Cluj-Napoca"));

        mvc.perform(put("/api/account/booking").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(settingsJson(false, slug, 1)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/public/stations/" + slug)).andExpect(status().isNotFound());
    }

    @Test
    void validatesSettings() throws Exception {
        mvc.perform(put("/api/account/booking").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(settingsJson(true, "Link Invalid!", 1)))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/account/booking").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true,\"slug\":\"ok-slug\",\"open\":\"17:00\",\"close\":\"08:00\",\"days\":[1],\"capacity\":1}"))
                .andExpect(status().isBadRequest());

        users.save(AppUser.builder().email("alta@itp.ro").password("x").role(Role.MANAGER).bookingSlug("luat").build());
        mvc.perform(put("/api/account/booking").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(settingsJson(true, "luat", 1)))
                .andExpect(status().isConflict());
    }

    @Test
    void bookingFillsSlotAndShowsUpInManagerCalendar() throws Exception {
        enableBooking("statie-test", 1);
        JsonNode slots = getJson("/api/public/stations/statie-test/slots?date=" + day);
        assertThat(slots).hasSize(18); // 08:00 - 17:00, sloturi de 30 min
        assertThat(slots.get(0).asText()).isEqualTo("08:00:00");

        book("statie-test", "10:00", "Ion Pop", "0722 111 222").andExpect(status().isCreated());

        JsonNode after = getJson("/api/public/stations/statie-test/slots?date=" + day);
        assertThat(after).hasSize(17);
        assertThat(after.toString()).doesNotContain("10:00:00");

        // acelasi slot din nou -> ocupat
        book("statie-test", "10:00", "Ana", "0733 111 222").andExpect(status().isConflict());

        JsonNode calendar = json.readTree(mvc.perform(get("/api/appointments?start=" + day + "T00:00:00&end=" + day.plusDays(1) + "T00:00:00")
                        .header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getContentAsString());
        assertThat(calendar).hasSize(1);
        assertThat(calendar.get(0).get("source").asText()).isEqualTo("ONLINE");
        assertThat(calendar.get(0).get("clientName").asText()).isEqualTo("Ion Pop");
    }

    @Test
    void capacityAllowsParallelBookings() throws Exception {
        enableBooking("doua-linii", 2);
        book("doua-linii", "09:00", "Ion", "0722111222").andExpect(status().isCreated());
        book("doua-linii", "09:00", "Ana", "0733111222").andExpect(status().isCreated());
        book("doua-linii", "09:00", "Dan", "0744111222").andExpect(status().isConflict());
    }

    @Test
    void rejectsInvalidRequests() throws Exception {
        enableBooking("validari", 1);
        book("validari", "10:00", "I", "0722111222").andExpect(status().isBadRequest());
        book("validari", "10:00", "Ion", "072").andExpect(status().isBadRequest());
        book("validari", "10:15", "Ion", "0722111222").andExpect(status().isConflict()); // nu e un slot
        book("necunoscut", "10:00", "Ion", "0722111222").andExpect(status().isNotFound());
        assertThat(getJson("/api/public/stations/validari/slots?date=" + LocalDate.now().minusDays(1))).isEmpty();
        assertThat(getJson("/api/public/stations/validari/slots?date=" + LocalDate.now().plusDays(60))).isEmpty();
    }

    @Test
    void honeypotAndRateLimitStopSpam() throws Exception {
        enableBooking("spam", 10);
        long before = appointments.count();
        mvc.perform(post("/api/public/stations/spam/appointments").header("X-Forwarded-For", ip)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bookingJson("11:00", "Bot", "0722111222", "http://spam")))
                .andExpect(status().isCreated());
        assertThat(appointments.count()).isEqualTo(before);

        String[] times = {"08:00", "08:30", "09:00", "09:30", "10:00"};
        for (String t : times) book("spam", t, "Ion", "0722111222").andExpect(status().isCreated());
        book("spam", "10:30", "Ion", "0722111222").andExpect(status().isTooManyRequests());
    }

    // ---------- helpers ----------

    private void enableBooking(String slug, int capacity) throws Exception {
        mvc.perform(put("/api/account/booking").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(settingsJson(true, slug, capacity)))
                .andExpect(status().isOk());
    }

    private JsonNode settings() throws Exception {
        return json.readTree(mvc.perform(get("/api/account/booking").header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getContentAsString());
    }

    private static String settingsJson(boolean enabled, String slug, int capacity) {
        // toate zilele, ca testele sa nu depinda de ziua saptamanii
        return "{\"enabled\":" + enabled + ",\"slug\":\"" + slug + "\",\"open\":\"08:00\",\"close\":\"17:00\","
                + "\"days\":[1,2,3,4,5,6,7],\"capacity\":" + capacity + "}";
    }

    private ResultActions book(String slug, String time, String name, String phone) throws Exception {
        return mvc.perform(post("/api/public/stations/" + slug + "/appointments").header("X-Forwarded-For", ip)
                .contentType(MediaType.APPLICATION_JSON)
                .content(bookingJson(time, name, phone, null)));
    }

    private String bookingJson(String time, String name, String phone, String website) throws Exception {
        var body = new java.util.LinkedHashMap<String, Object>();
        body.put("clientName", name);
        body.put("phone", phone);
        body.put("licensePlate", "CJ01" + UUID.randomUUID().toString().substring(0, 3).toUpperCase());
        body.put("appointmentDate", day + "T" + time + ":00");
        if (website != null) body.put("website", website);
        return json.writeValueAsString(body);
    }

    private JsonNode getJson(String url) throws Exception {
        return json.readTree(mvc.perform(get(url)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }
}
