package org.example.easyitp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.AppointmentRepository;
import org.example.easyitp.service.RomanianHolidays;
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
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Sincronizarea modificarilor facute fara internet: retrimiterea nu dubleaza, suprapunerile se marcheaza,
// modificarile pe o versiune veche intorc 409 cu varianta de acum, ITP-ul facut offline se salveaza mereu
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class SyncIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private AppointmentRepository appointments;
    @Autowired private PasswordEncoder encoder;

    private String token;
    private LocalDate day;
    private static int ips;

    @BeforeEach
    void setUp() throws Exception {
        users.save(AppUser.builder().email("sync@itp.ro").password(encoder.encode("secret12")).role(Role.MANAGER)
                .stationName("ITP Sync").build());
        token = login("sync@itp.ro");
        mvc.perform(put("/api/account/booking").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true,\"slug\":\"sync\",\"open\":\"08:00\",\"close\":\"17:00\",\"days\":[1,2,3,4,5,6,7],\"capacity\":1}"))
                .andExpect(status().isOk());
        day = LocalDate.now().plusDays(2);
        while (RomanianHolidays.nameOf(day) != null) day = day.plusDays(1);
    }

    @Test
    void resentOfflineAppointmentIsCreatedOnce() throws Exception {
        Map<String, Object> body = appt("Ion Pop", "09:00");
        body.put("clientRef", "c0ffee00-1111-2222-3333-444455556666");
        body.put("offline", true);
        long first = id(create(body).andExpect(status().isCreated()));
        long again = id(create(body).andExpect(status().isCreated()));
        assertThat(again).isEqualTo(first);
        assertThat(appointments.findByUserIdAndClientRef(users.findByEmailIgnoreCase("sync@itp.ro").orElseThrow().getId(),
                "c0ffee00-1111-2222-3333-444455556666")).isPresent();
        body.put("clientRef", "nu e bun!");
        create(body).andExpect(status().isBadRequest());
    }

    @Test
    void offlineAppointmentOverlappingAnOnlineBookingIsKeptAndFlagged() throws Exception {
        // un client se programeaza online la 10:00 (statia are o singura linie)
        mvc.perform(post("/api/public/stations/sync/appointments").header("CF-Connecting-IP", "10.77." + (++ips) + ".1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("clientName", "Online", "phone", "0722 111 222",
                                "appointmentDate", day + "T10:00:00", "vehicleCategory", "CAR"))))
                .andExpect(status().isCreated());

        // intre timp, fara internet, statia a pus pe cineva tot la 10:00
        Map<String, Object> body = appt("Ghișeu", "10:00");
        body.put("clientRef", "offline-ref-0001");
        body.put("offline", true);
        create(body).andExpect(status().isCreated()).andExpect(jsonPath("$.overlap").value(true));
        JsonNode inbox = get("/api/notifications");
        assertThat(inbox.get("items").get(0).get("kind").asText()).isEqualTo("SYNC_CONFLICT");
        assertThat(inbox.get("items").get(0).get("title").asText()).contains("Ghișeu");

        // cu internet, aceeasi suprapunere nu se marcheaza (managerul a vazut-o in fereastra programarii)
        create(appt("Cu net", "10:00")).andExpect(status().isCreated()).andExpect(jsonPath("$.overlap").doesNotExist());

        // mutata de manager pe o ora libera: marcajul dispare
        long flagged = appointments.findAll().stream().filter(a -> "offline-ref-0001".equals(a.getClientRef())).findFirst().orElseThrow().getId();
        JsonNode current = get("/api/appointments?start=" + day + "T00:00:00&end=" + day.plusDays(1) + "T00:00:00");
        int version = 0;
        for (JsonNode a : current) if (a.get("id").asLong() == flagged) version = a.get("version").asInt();
        Map<String, Object> moved = appt("Ghișeu", "13:00");
        moved.put("version", version);
        update(flagged, moved).andExpect(status().isOk()).andExpect(jsonPath("$.overlap").doesNotExist())
                .andExpect(jsonPath("$.version").value(version + 1));
    }

    @Test
    void staleChangesGet409WithTheCurrentVersion() throws Exception {
        JsonNode created = json.readTree(create(appt("Maria", "11:00")).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        long id = created.get("id").asLong();
        int v1 = created.get("version").asInt();

        // telefonul offline o muta pe 12:00, plecand de la versiunea v1
        Map<String, Object> offlineMove = appt("Maria", "12:00");
        offlineMove.put("version", v1);
        offlineMove.put("offline", true);

        // intre timp clientul o anuleaza din link
        String manage = appointments.findById(id).orElseThrow().getManageToken();
        mvc.perform(post("/api/public/appointments/" + manage + "/cancel")).andExpect(status().isOk());

        update(id, offlineMove).andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Programarea a fost schimbată între timp de altcineva."))
                .andExpect(jsonPath("$.current.status").value("CANCELLED"))
                .andExpect(jsonPath("$.current.version").value(v1 + 1));
        // stergerea pe versiunea veche: la fel
        mvc.perform(delete("/api/appointments/" + id + "?version=" + v1).header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());
        // managerul alege varianta lui: o trimite pe versiunea de acum
        offlineMove.put("version", v1 + 1);
        offlineMove.put("status", "SCHEDULED");
        update(id, offlineMove).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("SCHEDULED"));
        // fara versiune (clientii vechi) nu se verifica nimic
        offlineMove.remove("version");
        update(id, offlineMove).andExpect(status().isOk());
        mvc.perform(delete("/api/appointments/" + id).header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());
    }

    @Test
    void inspectorOfflineStatusAndItp() throws Exception {
        long inspectorId = json.readTree(mvc.perform(post("/api/inspectors").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Ana Pop\",\"defaultLine\":1}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
        users.save(AppUser.builder().email("ana.pop@sync").password(encoder.encode("secret12")).role(Role.INSPECTOR)
                .inspectorId(inspectorId).build());
        String inspector = login("ana.pop@sync");

        JsonNode a = json.readTree(create(appt("Vasile", "14:00")).andReturn().getResponse().getContentAsString());
        long id = a.get("id").asLong();
        int v = a.get("version").asInt();

        // statusul pe versiunea veche (managerul a mutat-o intre timp): 409
        Map<String, Object> moved = appt("Vasile", "14:30");
        moved.put("version", v);
        update(id, moved).andExpect(status().isOk());
        mvc.perform(put("/api/inspector-portal/appointments/" + id + "/status").header("Authorization", "Bearer " + inspector)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"NO_SHOW\",\"version\":" + v + "}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.current.appointmentDate").value(day + "T14:30:00"));

        // clientul anuleaza, dar inspectorul a facut ITP-ul offline: se salveaza o singura data, managerul afla
        String manage = appointments.findById(id).orElseThrow().getManageToken();
        mvc.perform(post("/api/public/appointments/" + manage + "/cancel")).andExpect(status().isOk());
        String itp = "{\"name\":\"Vasile\",\"phone\":\"0722 333 444\",\"licensePlate\":\"CJ 99 OFF\",\"brand\":\"Dacia\",\"model\":\"Logan\","
                + "\"testDate\":\"" + LocalDate.now() + "\",\"validityMonths\":24,\"status\":\"PASSED\",\"clientRef\":\"itp-offline-0001\"}";
        mvc.perform(post("/api/inspector-portal/appointments/" + id + "/itp").header("Authorization", "Bearer " + inspector)
                .contentType(MediaType.APPLICATION_JSON).content(itp)).andExpect(status().isOk());
        mvc.perform(post("/api/inspector-portal/appointments/" + id + "/itp").header("Authorization", "Bearer " + inspector)
                .contentType(MediaType.APPLICATION_JSON).content(itp)).andExpect(status().isOk());
        assertThat(appointments.findById(id).orElseThrow().getItpRecordId()).isNotNull();
        JsonNode records = get("/api/itp/records?q=CJ99OFF");
        assertThat(records.toString()).contains("CJ 99 OFF");
        assertThat(records.get("total").asLong()).isEqualTo(1);
        assertThat(get("/api/notifications").get("items").findValuesAsText("kind")).contains("SYNC_CONFLICT");
    }

    private Map<String, Object> appt(String name, String time) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("clientName", name);
        body.put("appointmentDate", day + "T" + time + ":00");
        body.put("durationMinutes", 20);
        return body;
    }

    private ResultActions create(Map<String, Object> body) throws Exception {
        return mvc.perform(post("/api/appointments").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }

    private ResultActions update(long id, Map<String, Object> body) throws Exception {
        return mvc.perform(put("/api/appointments/" + id).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }

    private long id(ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString()).get("id").asLong();
    }

    private JsonNode get(String url) throws Exception {
        return json.readTree(mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(url)
                        .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private String login(String email) throws Exception {
        return json.readTree(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"secret12\"}")).andReturn().getResponse().getContentAsString())
                .get("token").asText();
    }
}
