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
    void deepHealthChecksTheDatabaseWithoutLogin() throws Exception {
        mvc.perform(get("/api/health/deep"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.database").value("UP"));
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
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());
        login("m1@itp.ro", "newpass1");
    }

    // ---------- dashboard paginat (A3) ----------

    @Test
    void recordsArePagedSearchableByPlateWithoutSpacesAndMarkTheLatest() throws Exception {
        LocalDate today = LocalDate.now();
        createItp(manager, "Ion Pop", "CJ 13-FAN", today.minusYears(2));
        createItp(manager, "Ion Pop", "cj13fan", today.minusMonths(1));
        createItp(manager, "Ana Expirat", "B100XYZ", today.minusYears(1).minusDays(5));
        createItp(manager, "Dan Curand", "AB01DAN", today.minusYears(1).plusDays(10));
        createItp(otherManager, "Strain", "CJ13FAN", today);

        JsonNode latest = getJson("/api/itp/records?q=CJ13FAN", manager);
        assertThat(latest.get("total").asLong()).isEqualTo(1);
        assertThat(latest.get("items").get(0).get("ultimul").asBoolean()).isTrue();

        JsonNode all = getJson("/api/itp/records?q=cj 13&onlyLatest=false", manager);
        assertThat(all.get("total").asLong()).isEqualTo(2);
        long latestFlags = 0;
        for (JsonNode item : all.get("items")) if (item.get("ultimul").asBoolean()) latestFlags++;
        assertThat(latestFlags).isEqualTo(1);

        JsonNode page = getJson("/api/itp/records?size=2&page=1&onlyLatest=false", manager);
        assertThat(page.get("total").asLong()).isEqualTo(4);
        assertThat(page.get("items")).hasSize(2);
        assertThat(getJson("/api/itp/records?q=%", manager).get("total").asLong()).isZero();
        assertThat(getJson("/api/itp/records?q=ana", manager).get("total").asLong()).isEqualTo(1);

        JsonNode summary = getJson("/api/itp/summary", manager);
        assertThat(summary.get("vehicles").asLong()).isEqualTo(3);
        assertThat(summary.get("expired").asLong()).isEqualTo(1);
        assertThat(summary.get("expiringSoon").asLong()).isEqualTo(1);
        assertThat(summary.get("valid").asLong()).isEqualTo(1);

        JsonNode history = getJson("/api/itp/history?plate=CJ-13 FAN", manager);
        assertThat(history).hasSize(2);
        assertThat(history.get(0).get("dataItp").asText()).isEqualTo(today.minusMonths(1).toString());
        assertThat(getJson("/api/itp/lookup?plate=cj13fan", manager).get("dataItp").asText())
                .isEqualTo(today.minusMonths(1).toString());
    }

    // ---------- securitate (A1) ----------

    @Test
    void changingPasswordRevokesOldTokensButReturnsAWorkingOne() throws Exception {
        String otherDevice = login("m1@itp.ro", PASSWORD);
        String body = mvc.perform(put("/api/account/password").header("Authorization", bearer(manager))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"newpass1\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String fresh = json.readTree(body).get("token").asText();

        mvc.perform(get("/api/itp/dashboard").header("Authorization", bearer(manager))).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/itp/dashboard").header("Authorization", bearer(otherDevice))).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/itp/dashboard").header("Authorization", bearer(fresh))).andExpect(status().isOk());
    }

    @Test
    void adminPasswordResetRevokesManagerTokens() throws Exception {
        Long id = users.findByEmail("m1@itp.ro").orElseThrow().getId();
        mvc.perform(post("/api/admin/managers/" + id + "/reset-password").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"resetat1\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/itp/dashboard").header("Authorization", bearer(manager))).andExpect(status().isUnauthorized());
        login("m1@itp.ro", "resetat1");
    }

    @Test
    void emailsAreCaseInsensitive() throws Exception {
        login("  M1@ITP.ro ", PASSWORD);
        mvc.perform(post("/api/admin/create-user").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"M1@itp.RO\",\"password\":\"secret12\"}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/admin/create-user").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"Nou@Itp.ro\",\"password\":\"secret12\"}"))
                .andExpect(status().isCreated());
        assertThat(users.findByEmail("nou@itp.ro")).isPresent();
    }

    @Test
    void loginIsBlockedAfterTooManyFailuresForAnEmail() throws Exception {
        String wrong = "{\"email\":\"blocat@itp.ro\",\"password\":\"gresit\"}";
        for (int i = 0; i < 10; i++) {
            mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(wrong)
                            .header("CF-Connecting-IP", "10.0.0." + i))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(wrong)
                        .header("CF-Connecting-IP", "10.0.1.1"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void badDatesAndParametersAreBadRequestsWithMessage() throws Exception {
        mvc.perform(get("/api/appointments?start=nu-e-data&end=2026-01-01T00:00").header("Authorization", bearer(manager)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
        mvc.perform(get("/api/reports/export?from=2026-13-01&to=2026-12-31").header("Authorization", bearer(manager)))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/reports?year=abc").header("Authorization", bearer(manager)))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/itp").header("Authorization", bearer(manager))
                        .contentType(MediaType.APPLICATION_JSON).content("{nu e json"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/itp").header("Authorization", bearer(manager))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"licensePlate\":\"CJ01AAA\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void adminExportHasNoPlatesOrClientNames() throws Exception {
        LocalDate day = LocalDate.now().withDayOfMonth(1);
        createItp(manager, "Ion Popescu", "CJ01ABC", day, Map.of("price", 150));
        String csv = mvc.perform(get("/api/reports/export?from=" + day + "&to=" + day.plusMonths(1).minusDays(1))
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(csv).contains("TOTAL (1 ITP)").doesNotContain("CJ01ABC").doesNotContain("Popescu")
                .doesNotContain("Nr. inmatriculare");
    }

    @Test
    void exportsNeutralizeSpreadsheetFormulas() throws Exception {
        LocalDate day = LocalDate.now().withDayOfMonth(1);
        createItp(manager, "=HYPERLINK(\"http://x\")", "CJ09XYZ", day, Map.of("price", 10));
        String csv = mvc.perform(get("/api/itp/export").header("Authorization", bearer(manager)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(csv).contains("\"'=HYPERLINK(\"\"http://x\"\")\"");
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

    @Test
    void inspectorsAreSavedOnItpsAndRankedInReports() throws Exception {
        String saved = mvc.perform(put("/api/account/inspectors").header("Authorization", bearer(manager))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[\" Ion Pop \", \"ion pop\", \"\", \"Ana Marin\"]"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(json.readTree(saved).toString()).isEqualTo("[\"Ion Pop\",\"Ana Marin\"]");
        assertThat(getJson("/api/account/inspectors", manager)).hasSize(2);

        LocalDate day = LocalDate.now().withDayOfMonth(1);
        long id = createItp(manager, "Client", "CJ10INS", day, Map.of("inspector", "Ana Marin"));
        createItp(manager, "Client 2", "CJ11INS", day, Map.of("inspector", "Ana Marin", "status", "FAILED"));
        createItp(manager, "Client 3", "CJ12INS", day);

        JsonNode entry = getJson("/api/itp/dashboard", manager);
        assertThat(entry.toString()).contains("\"inspector\":\"Ana Marin\"");

        JsonNode inspectors = getJson("/api/reports?year=" + day.getYear(), manager).get("inspectors");
        assertThat(inspectors).hasSize(2);
        assertThat(inspectors.get(0).get("inspector").asText()).isEqualTo("Ana Marin");
        assertThat(inspectors.get(0).get("count").asLong()).isEqualTo(2);
        assertThat(inspectors.get(0).get("failed").asLong()).isEqualTo(1);
        assertThat(inspectors.get(1).get("inspector").asText()).isEqualTo("Nespecificat");

        // adminul vede doar cifre agregate, fara nume
        JsonNode adminReport = getJson("/api/reports?year=" + day.getYear(), admin);
        assertThat(adminReport.get("inspectors")).isEmpty();
        assertThat(adminReport.get("retention").get("lost")).isEmpty();
        assertThat(id).isPositive();
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

    @Test
    void inspectorsTeamLinesAppointmentsAndDashboard() throws Exception {
        mvc.perform(put("/api/account/booking").header("Authorization", bearer(manager)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":false,\"open\":\"08:00\",\"close\":\"17:00\",\"days\":[1,2,3,4,5,6,7],\"capacity\":2}"))
                .andExpect(status().isOk());
        long ana = json.readTree(sendJson(post("/api/inspectors"), "{\"name\":\" Ana  Marin \",\"phone\":\"0722 111 222\",\"defaultLine\":1}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Ana Marin"))
                .andExpect(jsonPath("$.color").value("blue"))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8)).get("id").asLong();
        long ion = json.readTree(sendJson(post("/api/inspectors"), "{\"name\":\"Ion Pop\"}")
                .andExpect(jsonPath("$.color").value("orange"))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8)).get("id").asLong();
        sendJson(post("/api/inspectors"), "{\"name\":\"ana marin\"}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field").value("name"));
        sendJson(post("/api/inspectors"), "{\"name\":\"Dan\",\"defaultLine\":3}").andExpect(jsonPath("$.field").value("defaultLine"));
        assertThat(getJson("/api/account/inspectors", manager).toString()).isEqualTo("[\"Ana Marin\",\"Ion Pop\"]");

        // azi: Ana pe linia 1 (linia ei), linia 2 libera; Ion e pus pe linia 2 doar azi
        LocalDate today = LocalDate.now();
        JsonNode shifts = getJson("/api/inspectors/shifts?date=" + today, manager);
        assertThat(shifts.get(0).get("inspectorId").asLong()).isEqualTo(ana);
        assertThat(shifts.get(0).get("source").asText()).isEqualTo("DEFAULT");
        assertThat(shifts.get(1).get("source").asText()).isEqualTo("NONE");
        shifts = json.readTree(sendJson(put("/api/inspectors/shifts"), "{\"date\":\"" + today + "\",\"line\":2,\"inspectorId\":" + ion + "}")
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
        assertThat(shifts.get(1).get("inspectorId").asLong()).isEqualTo(ion);
        assertThat(shifts.get(1).get("source").asText()).isEqualTo("DAY");

        // programarile: inspectorul liniei sau cel ales anume
        String at = today + "T23:00:00";
        sendJson(post("/api/appointments"), "{\"clientName\":\"Client L2\",\"appointmentDate\":\"" + at + "\",\"durationMinutes\":20,\"line\":2}")
                .andExpect(status().isCreated());
        sendJson(post("/api/appointments"), "{\"clientName\":\"Client Ana\",\"appointmentDate\":\"" + at + "\",\"durationMinutes\":20,\"line\":2,\"inspectorId\":" + ana + "}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.inspectorId").value(ana));
        sendJson(post("/api/appointments"), "{\"clientName\":\"Strain\",\"appointmentDate\":\"" + at + "\",\"inspectorId\":999999}")
                .andExpect(status().isNotFound());
        JsonNode calendar = getJson("/api/appointments?start=" + today + "T00:00:00&end=" + today + "T23:59:59", manager);
        assertThat(calendar).hasSize(2);
        assertThat(calendar.findValues("lineInspectorId").stream().map(JsonNode::asLong).toList()).containsOnly(ion);

        // ITP-urile, dupa nume; la redenumire numele se schimba si pe ITP-uri
        createItp(manager, "Client A", "CJ20INS", today, Map.of("inspector", "Ana Marin", "price", 150));
        createItp(manager, "Client B", "CJ21INS", today, Map.of("inspector", "Ana Marin", "status", "FAILED", "price", 150));
        createItp(manager, "Client C", "CJ22INS", today, Map.of("inspector", "Ion Pop", "price", 100));
        sendJson(put("/api/inspectors/" + ana), "{\"name\":\"Ana Pop\",\"defaultLine\":1,\"active\":true}").andExpect(status().isOk());
        assertThat(getJson("/api/itp/dashboard", manager).toString()).contains("\"inspector\":\"Ana Pop\"").doesNotContain("Ana Marin");

        JsonNode dash = getJson("/api/inspectors/dashboard?from=" + today.withDayOfMonth(1) + "&to=" + today, manager);
        assertThat(dash.get("totals").get("itps").asLong()).isEqualTo(3);
        assertThat(dash.get("totals").get("activeInspectors").asInt()).isEqualTo(2);
        JsonNode first = dash.get("inspectors").get(0);
        assertThat(first.get("name").asText()).isEqualTo("Ana Pop");
        assertThat(first.get("itps").asLong()).isEqualTo(2);
        assertThat(first.get("failed").asLong()).isEqualTo(1);
        assertThat(first.get("revenue").asDouble()).isEqualTo(300.0);
        assertThat(first.get("appointments").asLong()).isEqualTo(1);
        assertThat(first.get("todayLine").asInt()).isEqualTo(1);
        JsonNode second = dash.get("inspectors").get(1);
        assertThat(second.get("name").asText()).isEqualTo("Ion Pop");
        assertThat(second.get("appointments").asLong()).isEqualTo(1);
        assertThat(second.get("todayLine").asInt()).isEqualTo(2);
        assertThat(dash.get("days").get(dash.get("days").size() - 1).get("total").asLong()).isEqualTo(3);

        // stergerea pastreaza numele pe ITP-uri si scoate inspectorul de pe programari
        mvc.perform(delete("/api/inspectors/" + ana).header("Authorization", bearer(manager))).andExpect(status().isNoContent());
        assertThat(getJson("/api/itp/dashboard", manager).toString()).contains("\"inspector\":\"Ana Pop\"");
        assertThat(getJson("/api/appointments?start=" + today + "T00:00:00&end=" + today + "T23:59:59", manager)
                .findValues("inspectorId").stream().filter(n -> !n.isNull()).toList()).isEmpty();
        // alta statie nu vede si nu poate folosi inspectorii
        mvc.perform(put("/api/inspectors/" + ion).header("Authorization", bearer(otherManager)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"X\"}")).andExpect(status().isNotFound());
    }

    private org.springframework.test.web.servlet.ResultActions sendJson(
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, String body) throws Exception {
        return mvc.perform(request.header("Authorization", bearer(manager)).contentType(MediaType.APPLICATION_JSON).content(body));
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
