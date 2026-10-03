package org.example.easyitp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Client;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.entity.ItpStatus;
import org.example.easyitp.entity.Role;
import org.example.easyitp.entity.Vehicle;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.ClientRepository;
import org.example.easyitp.repository.ItpRecordRepository;
import org.example.easyitp.repository.VehicleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Teste end-to-end pe API (H2 in memorie); fiecare test ruleaza intr-o tranzactie anulata la final
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ApiIntegrationTest {

    private static final String PASSWORD = "secret12";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private ClientRepository clients;
    @Autowired private VehicleRepository vehicles;
    @Autowired private ItpRecordRepository records;
    @Autowired private PasswordEncoder encoder;

    private String admin;
    private String manager;
    private String otherManager;

    @BeforeEach
    void setUp() throws Exception {
        admin = login("admin@itp.ro", "admin-test-pass");
        manager = login(createManager("m1@itp.ro").getEmail(), PASSWORD);
        otherManager = login(createManager("m2@itp.ro").getEmail(), PASSWORD);
    }

    // ---------- autentificare si roluri ----------

    @Test
    void loginRejectsWrongPasswordAndDisabledAccounts() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"m1@itp.ro\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized());

        AppUser m1 = users.findByEmail("m1@itp.ro").orElseThrow();
        m1.setActive(false);
        users.save(m1);

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"m1@itp.ro\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isForbidden());
        // tokenul emis inainte de dezactivare nu mai e acceptat
        mvc.perform(get("/api/itp/dashboard").header("Authorization", bearer(manager)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void endpointsRequireTokenAndAdminRole() throws Exception {
        mvc.perform(get("/api/itp/dashboard")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/managers").header("Authorization", bearer(manager)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/managers").header("Authorization", bearer(admin)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/health")).andExpect(status().isOk());
    }

    @Test
    void changePasswordChecksCurrentPassword() throws Exception {
        mvc.perform(put("/api/account/password").header("Authorization", bearer(manager))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"bad\",\"newPassword\":\"newpass1\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/account/password").header("Authorization", bearer(manager))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"newpass1\"}"))
                .andExpect(status().isNoContent());
        login("m1@itp.ro", "newpass1");
    }

    // ---------- ITP si izolarea datelor ----------

    @Test
    void createItpReturnsOnlyIdWithoutAccountData() throws Exception {
        MvcResult result = mvc.perform(post("/api/itp").header("Authorization", bearer(manager))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(itpJson("Ion", "CJ01ABC", LocalDate.now(), Map.of())))
                .andExpect(status().isCreated())
                .andReturn();
        String body = result.getResponse().getContentAsString();
        assertThat(body).doesNotContain("password").doesNotContain("vehicle");
        assertThat(json.readTree(body).get("id").asLong()).isPositive();
    }

    @Test
    void managersCannotTouchOtherStationsRecords() throws Exception {
        long id = createItp(manager, "Ion", "CJ01ABC", LocalDate.now());

        mvc.perform(put("/api/itp/" + id).header("Authorization", bearer(otherManager))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(itpJson("Hacker", "CJ01ABC", LocalDate.now(), Map.of())))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/itp/" + id).header("Authorization", bearer(otherManager)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/itp/dashboard").header("Authorization", bearer(otherManager)))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void samePlateReusesVehicleAndOnlyLatestItpCounts() throws Exception {
        createItp(manager, "Ion", "CJ 01 ABC", LocalDate.now().minusMonths(13));
        createItp(manager, "Ion", "cj01-abc", LocalDate.now());

        JsonNode dashboard = getJson("/api/itp/dashboard", manager);
        assertThat(dashboard).hasSize(2);
        long latest = 0;
        for (JsonNode row : dashboard) {
            if (row.get("ultimul").asBoolean()) latest++;
        }
        assertThat(latest).isEqualTo(1);
        assertThat(vehicles.findAll()).hasSize(1);

        // ITP-ul vechi (expirat) nu apare la "De contactat", pentru ca vehiculul are ITP nou
        assertThat(getJson("/api/reminders", manager)).isEmpty();

        JsonNode lookup = getJson("/api/itp/lookup?plate=CJ01ABC", manager);
        assertThat(lookup.get("dataItp").asText()).isEqualTo(LocalDate.now().toString());
    }

    // ---------- De contactat ----------

    @Test
    void remindersCoverExpiringSoonAndRecentlyExpired() throws Exception {
        createItp(manager, "Ana", "CJ02BBB", LocalDate.now().minusMonths(12).plusDays(5));   // expira in 5 zile
        createItp(manager, "Dan", "CJ03CCC", LocalDate.now().minusMonths(12).minusDays(10)); // expirat de 10 zile
        createItp(manager, "Eva", "CJ04DDD", LocalDate.now().minusMonths(12).minusDays(100)); // prea vechi
        createItp(manager, "Gil", "CJ05EEE", LocalDate.now().minusMonths(2));                 // valid mult timp

        JsonNode reminders = getJson("/api/reminders", manager);
        assertThat(reminders).extracting(r -> r.get("numeSofer").asText()).containsExactlyInAnyOrder("Ana", "Dan");

        long id = reminders.get(0).get("id").asLong();
        mvc.perform(put("/api/reminders/" + id).header("Authorization", bearer(manager))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"CONTACTED\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(put("/api/reminders/" + id).header("Authorization", bearer(manager))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"FOO\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/reminders/" + id).header("Authorization", bearer(otherManager))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"CONTACTED\"}"))
                .andExpect(status().isNotFound());
    }

    // ---------- programari ----------

    @Test
    void appointmentConflictsAndCompletionWithItp() throws Exception {
        String date = LocalDate.now() + "T10:00:00";
        long apptId = json.readTree(mvc.perform(post("/api/appointments").header("Authorization", bearer(manager))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientName\":\"Ion\",\"licensePlate\":\"CJ01ABC\",\"appointmentDate\":\"" + date + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();

        assertThat(getJson("/api/appointments/conflicts?date=" + LocalDate.now() + "T10:20:00", manager)).hasSize(1);
        assertThat(getJson("/api/appointments/conflicts?date=" + LocalDate.now() + "T10:30:00", manager)).isEmpty();
        assertThat(getJson("/api/appointments/conflicts?date=" + date + "&excludeId=" + apptId, manager)).isEmpty();
        assertThat(getJson("/api/appointments/conflicts?date=" + date, otherManager)).isEmpty();

        long itpId = createItp(manager, "Ion", "CJ01ABC", LocalDate.now(), Map.of("appointmentId", apptId));
        JsonNode appts = getJson("/api/appointments?start=" + LocalDate.now() + "T00:00:00&end="
                + LocalDate.now().plusDays(1) + "T00:00:00", manager);
        assertThat(appts.get(0).get("status").asText()).isEqualTo("COMPLETED");
        assertThat(appts.get(0).get("itpRecordId").asLong()).isEqualTo(itpId);

        // ID-ul de programare al altei statii e respins si ITP-ul nu se salveaza
        mvc.perform(post("/api/itp").header("Authorization", bearer(otherManager))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(itpJson("X", "B01XYZ", LocalDate.now(), Map.of("appointmentId", apptId))))
                .andExpect(status().isNotFound());
    }

    // ---------- admin si rapoarte ----------

    @Test
    void adminStatsIgnoreLegacyClientsWithoutManager() throws Exception {
        createItp(manager, "Ion", "CJ01ABC", LocalDate.now());
        Client orphan = clients.save(Client.builder().name("Orfan").build());
        Vehicle vehicle = vehicles.save(Vehicle.builder().brand("Fiat").licensePlate("B01ORF").client(orphan).build());
        records.save(ItpRecord.builder().vehicle(vehicle).testDate(LocalDate.now()).validityMonths(12)
                .nextItpDate(LocalDate.now().plusYears(1)).status(ItpStatus.PASSED).price(99.0).build());

        JsonNode managers = getJson("/api/admin/managers", admin);
        JsonNode m1 = null;
        for (JsonNode m : managers) {
            if (m.get("email").asText().equals("m1@itp.ro")) m1 = m;
        }
        assertThat(m1).isNotNull();
        assertThat(m1.get("itpCount").asLong()).isEqualTo(1);

        JsonNode report = getJson("/api/reports?year=" + LocalDate.now().getYear(), admin);
        long total = 0;
        for (JsonNode month : report.get("months")) total += month.get("count").asLong();
        assertThat(total).isEqualTo(1);
    }

    @Test
    void managerReportIgnoresStationParameterAndExportHasTotals() throws Exception {
        LocalDate day = LocalDate.now().withDayOfMonth(1);
        createItp(manager, "Ion", "CJ01ABC", day, Map.of("price", 150.5));
        createItp(manager, "Ana", "CJ02BBB", day, Map.of("price", 100, "status", "FAILED"));
        createItp(otherManager, "Dan", "CJ03CCC", day, Map.of("price", 999));

        Long otherId = users.findByEmail("m2@itp.ro").orElseThrow().getId();
        JsonNode report = getJson("/api/reports?year=" + day.getYear() + "&stationId=" + otherId, manager);
        JsonNode month = report.get("months").get(day.getMonthValue() - 1);
        assertThat(month.get("count").asLong()).isEqualTo(2);
        assertThat(month.get("revenue").asDouble()).isEqualTo(250.5);
        assertThat(month.get("failed").asLong()).isEqualTo(1);

        String csv = mvc.perform(get("/api/reports/export?from=" + day + "&to=" + day.plusMonths(1).minusDays(1))
                        .header("Authorization", bearer(manager)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(csv).contains("sep=;").contains("Respins").contains("TOTAL (2 ITP);;;;;;;250,50").doesNotContain("Dan");
    }

    // ---------- helpers ----------

    private AppUser createManager(String email) {
        return users.save(AppUser.builder().email(email).password(encoder.encode(PASSWORD)).role(Role.MANAGER).build());
    }

    private String login(String email, String password) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    private JsonNode getJson(String url, String token) throws Exception {
        String body = mvc.perform(get(url).header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return json.readTree(body);
    }

    private String itpJson(String name, String plate, LocalDate testDate, Map<String, Object> extra) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("phone", "0722000000");
        body.put("brand", "Dacia");
        body.put("licensePlate", plate);
        body.put("testDate", testDate.toString());
        body.put("validityMonths", 12);
        body.put("price", 150);
        body.putAll(extra);
        return json.writeValueAsString(body);
    }

    private long createItp(String token, String name, String plate, LocalDate testDate) throws Exception {
        return createItp(token, name, plate, testDate, Map.of());
    }

    private long createItp(String token, String name, String plate, LocalDate testDate, Map<String, Object> extra) throws Exception {
        String body = mvc.perform(post("/api/itp").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(itpJson(name, plate, testDate, extra)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asLong();
    }
}
