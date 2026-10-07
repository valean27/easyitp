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
        assertThat(slots).hasSize(27); // 08:00 - 17:00, autoturism implicit 20 min
        assertThat(slots.get(0).asText()).isEqualTo("08:00:00");
        assertThat(slots.get(1).asText()).isEqualTo("08:20:00");

        book("statie-test", "10:00", "Ion Pop", "0722 111 222").andExpect(status().isCreated());

        JsonNode after = getJson("/api/public/stations/statie-test/slots?date=" + day);
        assertThat(after).hasSize(26);
        assertThat(after.toString()).doesNotContain("10:00:00");

        // acelasi slot din nou -> ocupat
        book("statie-test", "10:00", "Ana", "0733 111 222").andExpect(status().isConflict());

        JsonNode calendar = json.readTree(mvc.perform(get("/api/appointments?start=" + day + "T00:00:00&end=" + day.plusDays(1) + "T00:00:00")
                        .header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getContentAsString());
        assertThat(calendar).hasSize(1);
        assertThat(calendar.get(0).get("source").asText()).isEqualTo("ONLINE");
        assertThat(calendar.get(0).get("clientName").asText()).isEqualTo("Ion Pop");
        assertThat(calendar.get(0).get("vehicleCategory").asText()).isEqualTo("CAR");
        assertThat(calendar.get(0).get("durationMinutes").asInt()).isEqualTo(20);
    }

    @Test
    void longerInspectionsBlockTheirWholeIntervalAndCarsFitRightAfter() throws Exception {
        enableBooking("durate", 1);
        JsonNode station = getJson("/api/public/stations/durate");
        assertThat(station.get("vehicleTypes")).hasSize(3);
        assertThat(station.get("vehicleTypes").get(2).get("minutes").asInt()).isEqualTo(45);

        // autoutilitarele au grila lor: 08:00, 08:45, 09:30, ...
        String vans = getJson("/api/public/stations/durate/slots?category=VAN&date=" + day).toString();
        assertThat(vans).contains("08:00:00", "08:45:00", "09:30:00").doesNotContain("10:00:00");

        // autoutilitara 09:30 - 10:15
        book("durate", "09:30", "Van", "0722111222", "VAN").andExpect(status().isCreated());

        String cars = getJson("/api/public/stations/durate/slots?category=CAR&date=" + day).toString();
        assertThat(cars).doesNotContain("09:20:00", "09:40:00", "10:00:00");
        assertThat(cars).contains("09:00:00", "10:15:00", "10:20:00"); // 10:15 = imediat dupa autoutilitara

        vans = getJson("/api/public/stations/durate/slots?category=VAN&date=" + day).toString();
        assertThat(vans).contains("08:45:00", "10:15:00").doesNotContain("09:30:00");

        book("durate", "10:00", "Ion", "0733111222", "CAR").andExpect(status().isConflict());
        book("durate", "10:15", "Ion", "0733111222", "CAR").andExpect(status().isCreated()); // 10:15 - 10:35

        // verificarea suprapunerilor din calendarul managerului tine cont de durata
        assertThat(conflicts("09:50", 20)).hasSize(1);
        assertThat(conflicts("10:00", 20)).hasSize(2); // autoutilitara + autoturismul de la 10:15
        assertThat(conflicts("10:35", 20)).isEmpty();
        assertThat(conflicts("09:00", 45)).hasSize(1);
    }

    @Test
    void stationChoosesTypesAndDurations() throws Exception {
        putSettings(settingsJson(true, "tipuri", 1, "[{'category':'CAR','minutes':7,'enabled':true}]"))
                .andExpect(status().isBadRequest());
        putSettings(settingsJson(true, "tipuri", 1, "[{'category':'CAR','minutes':20,'enabled':false}]"))
                .andExpect(status().isBadRequest());
        putSettings(settingsJson(true, "tipuri", 1, "[{'category':'CAR','minutes':25,'enabled':true},"
                + "{'category':'MOTORCYCLE','minutes':15,'enabled':true}]"))
                .andExpect(status().isOk());

        JsonNode types = getJson("/api/public/stations/tipuri").get("vehicleTypes");
        assertThat(types).hasSize(2);
        assertThat(types.get(0).get("minutes").asInt()).isEqualTo(25);
        assertThat(types.get(1).get("category").asText()).isEqualTo("MOTORCYCLE");
        assertThat(getJson("/api/public/stations/tipuri/slots?category=MOTORCYCLE&date=" + day)).hasSize(36);

        // tipurile dezactivate nu se pot programa online
        book("tipuri", "10:00", "Van", "0722111222", "VAN").andExpect(status().isBadRequest());
        // managerul vede si tipurile dezactivate, cu durata implicita
        assertThat(settings().get("vehicleTypes")).hasSize(5);
    }

    @Test
    void capacityAllowsParallelBookings() throws Exception {
        enableBooking("doua-linii", 2);
        book("doua-linii", "08:45", "Ion", "0722111222", "VAN").andExpect(status().isCreated()); // 08:45 - 09:30
        book("doua-linii", "09:00", "Ana", "0733111222").andExpect(status().isCreated());        // 09:00 - 09:20
        book("doua-linii", "09:00", "Dan", "0744111222").andExpect(status().isConflict());
        // a doua linie se elibereaza la 09:20, desi autoutilitara ruleaza pana la 09:30
        book("doua-linii", "09:20", "Dan", "0744111222").andExpect(status().isCreated());
        ip = ip + "9"; // limita anti-spam: 5 programari pe ora de pe acelasi IP
        book("doua-linii", "09:20", "Eva", "0755111222").andExpect(status().isConflict());
        book("doua-linii", "09:40", "Eva", "0755111222").andExpect(status().isCreated());
    }

    @Test
    void appointmentsGetALineAndTheManagerCanPickOne() throws Exception {
        enableBooking("trei-linii", 3);
        putSettings(settingsJson(true, "trei-linii", 3).replace("}", ",\"lineNames\":[\"Autoturisme\",\"\",\" Camioane  mari \"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lineNames[0]").value("Autoturisme"))
                .andExpect(jsonPath("$.lineNames[1]").value(""))
                .andExpect(jsonPath("$.lineNames[2]").value("Camioane mari"));

        book("trei-linii", "10:00", "Ion", "0722111222").andExpect(status().isCreated());
        book("trei-linii", "10:00", "Ana", "0733111222").andExpect(status().isCreated());
        JsonNode calendar = calendar();
        assertThat(calendar.get(0).get("line").asInt()).isEqualTo(1);
        assertThat(calendar.get(1).get("line").asInt()).isEqualTo(2);

        // managerul fara linie -> prima libera (3); cu linie -> exact aceea, chiar daca e ocupata
        long free = createAppointment("{\"clientName\":\"Dan\",\"appointmentDate\":\"" + day + "T10:05:00\",\"durationMinutes\":20}", 3);
        createAppointment("{\"clientName\":\"Eva\",\"appointmentDate\":\"" + day + "T10:05:00\",\"durationMinutes\":20,\"line\":1}", 1);
        mvc.perform(post("/api/appointments").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientName\":\"Rau\",\"appointmentDate\":\"" + day + "T10:05:00\",\"line\":4}"))
                .andExpect(status().isBadRequest());
        assertThat(conflicts("10:10", 20).findValues("line").stream().map(JsonNode::asInt).sorted().toList())
                .containsExactly(1, 1, 2, 3);

        // mutata la 12:00 fara linie: ramane pe linia ei, fiindca e libera
        mvc.perform(put("/api/appointments/" + free).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientName\":\"Dan\",\"appointmentDate\":\"" + day + "T12:00:00\",\"durationMinutes\":20}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.line").value(3));
        // si inapoi la 10:00, unde linia 3 e libera, dar mutata pe linia 2 (ocupata de Ana) ramane cum a cerut managerul
        mvc.perform(put("/api/appointments/" + free).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientName\":\"Dan\",\"appointmentDate\":\"" + day + "T10:00:00\",\"durationMinutes\":20,\"line\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.line").value(2));
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
        mvc.perform(post("/api/public/stations/spam/appointments").header("CF-Connecting-IP", ip)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bookingJson("11:00", "Bot", "0722111222", "http://spam")))
                .andExpect(status().isCreated());
        assertThat(appointments.count()).isEqualTo(before);

        String[] times = {"08:00", "08:20", "08:40", "09:00", "09:20"};
        for (String t : times) book("spam", t, "Ion", "0722111222").andExpect(status().isCreated());
        book("spam", "09:40", "Ion", "0722111222").andExpect(status().isTooManyRequests());
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

    private ResultActions putSettings(String body) throws Exception {
        return mvc.perform(put("/api/account/booking").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private static String settingsJson(boolean enabled, String slug, int capacity) {
        return settingsJson(enabled, slug, capacity, null);
    }

    private static String settingsJson(boolean enabled, String slug, int capacity, String vehicleTypes) {
        // toate zilele, ca testele sa nu depinda de ziua saptamanii
        return "{\"enabled\":" + enabled + ",\"slug\":\"" + slug + "\",\"open\":\"08:00\",\"close\":\"17:00\","
                + "\"days\":[1,2,3,4,5,6,7],\"capacity\":" + capacity
                + (vehicleTypes != null ? ",\"vehicleTypes\":" + vehicleTypes.replace('\'', '"') : "") + "}";
    }

    private ResultActions book(String slug, String time, String name, String phone) throws Exception {
        return book(slug, time, name, phone, null);
    }

    private ResultActions book(String slug, String time, String name, String phone, String category) throws Exception {
        return mvc.perform(post("/api/public/stations/" + slug + "/appointments").header("CF-Connecting-IP", ip)
                .contentType(MediaType.APPLICATION_JSON)
                .content(bookingJson(time, name, phone, null, category)));
    }

    private JsonNode calendar() throws Exception {
        return json.readTree(mvc.perform(get("/api/appointments?start=" + day + "T00:00:00&end=" + day.plusDays(1) + "T00:00:00")
                        .header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getContentAsString());
    }

    private long createAppointment(String body, int expectedLine) throws Exception {
        return json.readTree(mvc.perform(post("/api/appointments").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.line").value(expectedLine))
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
    }

    private JsonNode conflicts(String time, int minutes) throws Exception {
        return json.readTree(mvc.perform(get("/api/appointments/conflicts?date=" + day + "T" + time + ":00&minutes=" + minutes)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    private String bookingJson(String time, String name, String phone, String website) throws Exception {
        return bookingJson(time, name, phone, website, null);
    }

    private String bookingJson(String time, String name, String phone, String website, String category) throws Exception {
        var body = new java.util.LinkedHashMap<String, Object>();
        if (category != null) body.put("vehicleCategory", category);
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
