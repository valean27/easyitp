package org.example.easyitp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Plan;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
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
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Abonamente (E1): inscrierea cu proba, functiile blocate pe Gratuit, plata Netopia (pornire, notificare verificata
// la Netopia, aplicata o singura data) si factura platformei in Oblio. Netopia si Oblio sunt un server local.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class SubscriptionIntegrationTest {

    private static final String PASSWORD = "secret12";
    private static final AtomicInteger NETOPIA_STATUS = new AtomicInteger(1);
    private static final List<String> STARTS = new CopyOnWriteArrayList<>();
    private static final List<String> INVOICES = new CopyOnWriteArrayList<>();
    private static final HttpServer SERVER;

    static {
        try {
            SERVER = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            SERVER.createContext("/", exchange -> {
                String path = exchange.getRequestURI().getPath();
                String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                String json;
                if (path.endsWith("/payment/card/start")) {
                    STARTS.add(exchange.getRequestHeaders().getFirst("Authorization") + " " + body);
                    json = "{\"payment\":{\"ntpID\":\"NTP1\",\"status\":1,\"paymentURL\":\"https://pay.test/abc\"},"
                            + "\"error\":{\"code\":\"101\",\"message\":\"Redirect user to payment page\"}}";
                } else if (path.endsWith("/operation/status")) {
                    json = "{\"payment\":{\"ntpID\":\"NTP1\",\"status\":" + NETOPIA_STATUS.get() + "}}";
                } else if (path.endsWith("/authorize/token")) {
                    json = "{\"access_token\":\"tok\",\"expires_in\":\"3600\"}";
                } else if (path.endsWith("/docs/invoice")) {
                    INVOICES.add(body);
                    json = "{\"status\":200,\"data\":{\"seriesName\":\"EI\",\"number\":\"0007\",\"link\":\"https://oblio.test/f\"}}";
                } else if (path.endsWith("/docs/einvoice")) {
                    json = "{\"status\":200,\"data\":{\"text\":\"Trimisa\"}}";
                } else {
                    json = "{}";
                }
                byte[] out = json.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, out.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(out);
                }
            });
            SERVER.start();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        String base = "http://127.0.0.1:" + SERVER.getAddress().getPort();
        r.add("netopia.url", () -> base);
        r.add("netopia.api-key", () -> "cheie-netopia");
        r.add("netopia.pos-signature", () -> "POS-1");
        r.add("oblio.url", () -> base + "/api");
        r.add("platform.oblio.email", () -> "platforma@easyitp.ro");
        r.add("platform.oblio.secret", () -> "s");
        r.add("platform.oblio.cif", () -> "RO48267925");
        r.add("platform.oblio.series", () -> "EI");
    }

    @AfterAll
    static void stop() {
        SERVER.stop(0);
    }

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private PasswordEncoder encoder;

    private final LocalDate today = LocalDate.now();

    @BeforeEach
    void reset() {
        NETOPIA_STATUS.set(1);
    }

    @Test
    void signupCreatesATrialAccountReadyToUse() throws Exception {
        String body = json.writeValueAsString(Map.of("stationName", "ITP Nou", "city", "Baia Mare", "phone", "0745 123 456",
                "email", "Nou@ITP.ro", "password", "parola123", "acceptTerms", true));
        JsonNode res = json.readTree(mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
        assertThat(res.get("email").asText()).isEqualTo("nou@itp.ro");
        assertThat(res.get("role").asText()).isEqualTo("MANAGER");

        mvc.perform(get("/api/billing/status").header("Authorization", "Bearer " + res.get("token").asText()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan").value("PREMIUM"))
                .andExpect(jsonPath("$.trial").value(true))
                .andExpect(jsonPath("$.daysLeft").value(14))
                .andExpect(jsonPath("$.features.length()").value(7))
                .andExpect(jsonPath("$.paymentsAvailable").value(true));

        // acelasi email, cu alte litere -> 409
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body.replace("Nou@ITP.ro", "nou@itp.RO")))
                .andExpect(status().isConflict());
        // fara acordul pe termeni: campul e marcat
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                        "stationName", "ITP 2", "city", "Cluj", "phone", "0745123456", "email", "doi@itp.ro", "password", "parola123"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field").value("acceptTerms"));
        // bot (campul capcana): raspuns fara cont
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                        "stationName", "ITP 3", "city", "Cluj", "phone", "0745123456", "email", "bot@itp.ro", "password", "parola123",
                        "acceptTerms", true, "website", "http://spam"))))
                .andExpect(status().isAccepted());
        assertThat(users.existsByEmailIgnoreCase("bot@itp.ro")).isFalse();
    }

    @Test
    void freePlanLocksPaidFeaturesButKeepsTheData() throws Exception {
        String token = manager("free@itp.ro", Plan.PREMIUM, today.minusDays(1), true);

        mvc.perform(get("/api/billing/status").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.plan").value("FREE"))
                .andExpect(jsonPath("$.trial").value(false))
                .andExpect(jsonPath("$.features.length()").value(0));
        mvc.perform(get("/api/fleets").header("Authorization", "Bearer " + token))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.message").value("Flotele fac parte din pachetul Premium. Alegeți pachetul în Contul meu → Abonament."));
        mvc.perform(get("/api/station-deadlines").header("Authorization", "Bearer " + token)).andExpect(status().isPaymentRequired());
        mvc.perform(multipart("/api/itp/scan-registration").file(new MockMultipartFile("image", "t.jpg", "image/jpeg", new byte[]{1}))
                .header("Authorization", "Bearer " + token)).andExpect(status().isPaymentRequired());
        mvc.perform(put("/api/account/auto-sms").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true,\"provider\":\"SMS_GATE\",\"apptConfirmSms\":false,\"apptReminderSms\":false,\"deadlinesSms\":false}"))
                .andExpect(status().isPaymentRequired());
        // rapoartele: lunile raman, partea pentru patron nu
        mvc.perform(get("/api/reports").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.months.length()").value(12))
                .andExpect(jsonPath("$.retention").doesNotExist());
        // evidenta ITP merge in continuare
        mvc.perform(get("/api/itp/summary").header("Authorization", "Bearer " + token)).andExpect(status().isOk());

        // contul vechi (fara pachet) are tot
        String legacy = manager("vechi@itp.ro", null, null, false);
        mvc.perform(get("/api/fleets").header("Authorization", "Bearer " + legacy)).andExpect(status().isOk());
    }

    @Test
    void paymentIsVerifiedAtNetopiaAndAppliedOnce() throws Exception {
        String token = manager("plata@itp.ro", Plan.PREMIUM, today.plusDays(5), true);

        // fara date de facturare nu se poate plati
        checkout(token, "PRO", 300, 1).andExpect(status().isBadRequest());
        mvc.perform(put("/api/billing/details").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"ITP Plata SRL\",\"cui\":\"ro 123456\",\"address\":\"Str. Lupului 1\",\"city\":\"Baia Mare\",\"county\":\"Maramureș\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cui").value("RO123456"));

        JsonNode started = json.readTree(checkout(token, "PRO", 300, 1).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
        String orderId = started.get("orderId").asText();
        assertThat(started.get("paymentUrl").asText()).isEqualTo("https://pay.test/abc");
        JsonNode sent = json.readTree(STARTS.get(STARTS.size() - 1).substring("cheie-netopia ".length()));
        assertThat(sent.get("order").get("posSignature").asText()).isEqualTo("POS-1");
        // 59 + 119, cu TVA inclus
        assertThat(sent.get("order").get("amount").decimalValue()).isEqualByComparingTo("178");
        assertThat(sent.get("order").get("currency").asText()).isEqualTo("RON");
        assertThat(sent.get("config").get("redirectUrl").asText()).endsWith("/plata?order=" + orderId);

        // notificare cu "platit" in corp, dar Netopia spune inca "in curs" -> nimic
        ipn(orderId);
        assertThat(user("plata@itp.ro").getPlanTrial()).isTrue();

        NETOPIA_STATUS.set(3);
        ipn(orderId);
        AppUser u = user("plata@itp.ro");
        assertThat(u.getPlan()).isEqualTo(Plan.PRO);
        assertThat(u.getPlanTrial()).isFalse();
        assertThat(u.getSmsPlan()).isEqualTo(300);
        assertThat(u.getPlanUntil()).isEqualTo(today.plusDays(5).plusMonths(1));

        // a doua notificare si intoarcerea din pagina nu mai prelungesc
        ipn(orderId);
        mvc.perform(post("/api/billing/payments/" + orderId + "/refresh").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAID"))
                .andExpect(jsonPath("$.invoiceNumber").value("EI 0007"));
        assertThat(user("plata@itp.ro").getPlanUntil()).isEqualTo(today.plusDays(5).plusMonths(1));
        assertThat(INVOICES).hasSize(1);
        JsonNode invoice = json.readTree(INVOICES.get(0));
        assertThat(invoice.get("cif").asText()).isEqualTo("RO48267925");
        assertThat(invoice.get("client").get("cif").asText()).isEqualTo("RO123456");
        assertThat(invoice.get("products")).hasSize(2);
        assertThat(invoice.get("products").get(0).get("price").asInt()).isEqualTo(59);
        assertThat(invoice.get("products").get(1).get("price").asInt()).isEqualTo(119);
        assertThat(invoice.get("products").get(0).get("vatIncluded").asBoolean()).isTrue();

        // plata altei statii nu se poate citi
        String other = manager("alta@itp.ro", null, null, false);
        mvc.perform(post("/api/billing/payments/" + orderId + "/refresh").header("Authorization", "Bearer " + other))
                .andExpect(status().isNotFound());
    }

    @Test
    void adminGrantsAPlanAndSeesIt() throws Exception {
        String token = manager("acordat@itp.ro", Plan.PREMIUM, today.minusDays(3), true);
        AppUser u = user("acordat@itp.ro");
        String admin = login("admin@itp.ro", "admin-test-pass");
        mvc.perform(put("/api/admin/managers/" + u.getId() + "/plan").header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"plan\":\"PRO\",\"until\":\"" + today.plusYears(1) + "\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/billing/status").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.plan").value("PRO"))
                .andExpect(jsonPath("$.trial").value(false));
        mvc.perform(get("/api/admin/managers").header("Authorization", "Bearer " + admin))
                .andExpect(jsonPath("$[?(@.email == 'acordat@itp.ro')].plan").value("PRO"));
        // managerul nu poate folosi endpoint-ul adminului
        mvc.perform(put("/api/admin/managers/" + u.getId() + "/plan").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"plan\":\"PREMIUM\"}")).andExpect(status().isForbidden());
    }

    private org.springframework.test.web.servlet.ResultActions checkout(String token, String plan, int sms, int months) throws Exception {
        return mvc.perform(post("/api/billing/checkout").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"plan\":\"" + plan + "\",\"smsPlan\":" + sms + ",\"months\":" + months + "}"));
    }

    private void ipn(String orderId) throws Exception {
        mvc.perform(post("/api/public/netopia/ipn").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"order\":{\"orderID\":\"" + orderId + "\"},\"payment\":{\"status\":3}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.errorType").value(0));
    }

    private AppUser user(String email) {
        return users.findByEmail(email).orElseThrow();
    }

    private String manager(String email, Plan plan, LocalDate until, boolean trial) throws Exception {
        users.save(AppUser.builder().email(email).password(encoder.encode(PASSWORD)).role(Role.MANAGER).stationName("ITP")
                .phone("0745123456").plan(plan).planUntil(until).planTrial(trial).build());
        return login(email, PASSWORD);
    }

    private String login(String email, String password) throws Exception {
        String res = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(res).get("token").asText();
    }
}
