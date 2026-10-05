package org.example.easyitp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Facturare prin Oblio: setari, optiunile contului, factura pentru centralizatorul unei flote si pentru un ITP,
// trimiterea in SPV si refuzul unei a doua facturi. Oblio e inlocuit de un server local.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class OblioInvoiceIntegrationTest {

    private static final String PASSWORD = "secret12";
    private static final List<String> CALLS = new CopyOnWriteArrayList<>();
    private static final List<String> INVOICES = new CopyOnWriteArrayList<>();
    private static final AtomicInteger NUMBER = new AtomicInteger(52);
    private static final HttpServer SERVER;

    static {
        try {
            SERVER = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            SERVER.createContext("/", exchange -> {
                String path = exchange.getRequestURI().getPath();
                String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                CALLS.add(exchange.getRequestMethod() + " " + path + " " + exchange.getRequestHeaders().getFirst("Authorization"));
                String json;
                int status = 200;
                if (path.endsWith("/authorize/token")) {
                    if (!body.contains("client_secret=cheie-buna")) {
                        status = 401;
                        json = "{\"status\":401,\"statusMessage\":\"Invalid credentials\"}";
                    } else {
                        json = "{\"access_token\":\"tok123\",\"expires_in\":\"3600\",\"token_type\":\"Bearer\"}";
                    }
                } else if (path.endsWith("/nomenclature/companies")) {
                    json = "{\"status\":200,\"data\":[{\"cif\":\"RO123\",\"company\":\"ITP EXEMPLU SRL\"}]}";
                } else if (path.endsWith("/nomenclature/series")) {
                    json = "{\"status\":200,\"data\":[{\"type\":\"Factura\",\"name\":\"ITP\"},{\"type\":\"Proforma\",\"name\":\"PRF\"}]}";
                } else if (path.endsWith("/nomenclature/vat_rates")) {
                    json = "{\"status\":200,\"data\":[{\"name\":\"Normala\",\"percent\":21,\"default\":true},{\"name\":\"SDD\",\"percent\":0}]}";
                } else if (path.endsWith("/docs/invoice")) {
                    INVOICES.add(body);
                    json = "{\"status\":200,\"statusMessage\":\"Success\",\"data\":{\"seriesName\":\"ITP\",\"number\":\"00"
                            + NUMBER.incrementAndGet() + "\",\"link\":\"https://www.oblio.eu/utils/show_file/?id=1\"}}";
                } else if (path.endsWith("/docs/einvoice")) {
                    json = "{\"status\":200,\"data\":{\"code\":0,\"text\":\"Factura a fost trimisa in SPV\"}}";
                } else {
                    status = 404;
                    json = "{\"status\":404,\"statusMessage\":\"Not found\"}";
                }
                byte[] out = json.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(status, out.length);
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
        r.add("oblio.url", () -> "http://127.0.0.1:" + SERVER.getAddress().getPort() + "/api");
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
    private String manager;

    @BeforeEach
    void setUp() throws Exception {
        users.save(AppUser.builder().email("o1@itp.ro").password(encoder.encode(PASSWORD)).role(Role.MANAGER)
                .stationName("ITP Exemplu").build());
        manager = login();
    }

    @Test
    void settingsAreValidatedAgainstTheOblioAccount() throws Exception {
        send(put("/api/invoicing/settings"), settings("contabil@firma.ro", "cheie-gresita")).andExpect(status().isOk())
                .andExpect(jsonPath("$.hasSecret").value(true)).andExpect(jsonPath("$.secret").doesNotExist())
                .andExpect(jsonPath("$.ready").value(false));
        mvc.perform(get("/api/invoicing/options").header("Authorization", "Bearer " + manager))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Oblio nu a acceptat emailul sau cheia API."));

        send(put("/api/invoicing/settings"), settings("contabil@firma.ro", "cheie-buna")).andExpect(status().isOk());
        mvc.perform(get("/api/invoicing/options").header("Authorization", "Bearer " + manager))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.companies[0].cif").value("RO123"))
                // o singura firma: seriile si cotele vin direct; proformele nu apar
                .andExpect(jsonPath("$.series.length()").value(1))
                .andExpect(jsonPath("$.series[0]").value("ITP"))
                .andExpect(jsonPath("$.vatRates[0].percent").value(21.0));

        // fara configurare completa nu se emite nimic
        mvc.perform(post("/api/invoicing/itp/1").header("Authorization", "Bearer " + manager))
                .andExpect(status().isBadRequest());
    }

    @Test
    void fleetStatementBecomesOneInvoiceAndOnlyOnce() throws Exception {
        configure(true);
        long fleetId = createFleet();
        itp("Sofer 1", "CJ01FLT", 150.0);
        itp("Sofer 2", "CJ02FLT", 180.0);
        itp("Alt client", "CJ09XXX", 100.0);
        String month = YearMonth.from(today).toString();

        mvc.perform(get("/api/invoicing/fleets/" + fleetId).param("month", month).header("Authorization", "Bearer " + manager))
                .andExpect(status().isNoContent());
        JsonNode inv = json.readTree(mvc.perform(post("/api/invoicing/fleets/" + fleetId).param("month", month)
                        .header("Authorization", "Bearer " + manager))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
        assertThat(inv.get("seriesName").asText()).isEqualTo("ITP");
        assertThat(inv.get("total").asDouble()).isEqualTo(330.0);
        assertThat(inv.get("einvoiceStatus").asText()).contains("SPV");

        JsonNode sent = json.readTree(INVOICES.get(INVOICES.size() - 1));
        assertThat(sent.get("cif").asText()).isEqualTo("RO123");
        assertThat(sent.get("seriesName").asText()).isEqualTo("ITP");
        assertThat(sent.get("client").get("cif").asText()).isEqualTo("RO998877");
        assertThat(sent.get("client").get("city").asText()).isEqualTo("Cluj-Napoca");
        assertThat(sent.get("products")).hasSize(2);
        assertThat(sent.get("products").get(0).get("vatName").asText()).isEqualTo("Normala");
        assertThat(sent.get("products").get(0).get("vatIncluded").asBoolean()).isTrue();
        assertThat(sent.get("products").get(0).get("description").asText()).startsWith("CJ01FLT");
        assertThat(CALLS).anyMatch(c -> c.startsWith("POST /api/docs/invoice Bearer tok123"));

        mvc.perform(post("/api/invoicing/fleets/" + fleetId).param("month", month).header("Authorization", "Bearer " + manager))
                .andExpect(status().isConflict());
        mvc.perform(get("/api/invoicing/fleets/" + fleetId).param("month", month).header("Authorization", "Bearer " + manager))
                .andExpect(status().isOk()).andExpect(jsonPath("$.number").value(inv.get("number").asText()));
    }

    @Test
    void oneItpCanBeInvoicedForAPerson() throws Exception {
        configure(false);
        itp("Ion Persoana", "CJ05PER", 160.0);
        long id = json.readTree(mvc.perform(get("/api/itp/history?plate=CJ05PER").header("Authorization", "Bearer " + manager))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8)).get(0).get("id").asLong();
        mvc.perform(post("/api/invoicing/itp/" + id).header("Authorization", "Bearer " + manager))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.clientName").value("Ion Persoana"))
                .andExpect(jsonPath("$.einvoiceStatus").doesNotExist());
        JsonNode sent = json.readTree(INVOICES.get(INVOICES.size() - 1));
        assertThat(sent.get("client").has("cif")).isFalse();
        assertThat(sent.get("products").get(0).get("price").asDouble()).isEqualTo(160.0);
        mvc.perform(post("/api/invoicing/itp/" + id).header("Authorization", "Bearer " + manager)).andExpect(status().isConflict());
    }

    // ---------- ajutatoare ----------

    private void configure(boolean einvoice) throws Exception {
        Map<String, Object> s = settings("contabil@firma.ro", "cheie-buna");
        s.put("cif", "RO123");
        s.put("series", "ITP");
        s.put("vatName", "Normala");
        s.put("vatPercent", 21);
        s.put("einvoice", einvoice);
        send(put("/api/invoicing/settings"), s).andExpect(status().isOk()).andExpect(jsonPath("$.ready").value(true));
    }

    private static Map<String, Object> settings(String email, String secret) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("email", email);
        s.put("secret", secret);
        s.put("vatIncluded", true);
        s.put("einvoice", false);
        s.put("dueDays", 15);
        return s;
    }

    private long createFleet() throws Exception {
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("name", "Transport SRL");
        f.put("cui", "RO998877");
        f.put("plates", List.of("CJ01FLT", "CJ02FLT"));
        f.put("address", "Str. Fabricii 1");
        f.put("city", "Cluj-Napoca");
        f.put("county", "Cluj");
        String res = send(post("/api/fleets"), f).andExpect(status().is2xxSuccessful()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        return json.readTree(res).get("id").asLong();
    }

    private void itp(String name, String plate, double price) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("phone", "0722 000 001");
        body.put("brand", "Dacia");
        body.put("licensePlate", plate);
        body.put("testDate", today.toString());
        body.put("validityMonths", 12);
        body.put("price", price);
        send(post("/api/itp"), body).andExpect(status().isCreated());
    }

    private String login() throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"o1@itp.ro\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    private ResultActions send(MockHttpServletRequestBuilder request, Object body) throws Exception {
        return mvc.perform(request.header("Authorization", "Bearer " + manager)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }
}
