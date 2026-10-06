package org.example.easyitp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.entity.SmsProvider;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.service.DeliveryException;
import org.example.easyitp.service.SmsQuotaService;
import org.example.easyitp.service.SmsSender;
import org.junit.jupiter.api.AfterAll;
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
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// SMS incluse in abonament: contul SMSLink al platformei, pachetul lunar al statiei si oprirea la cota
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class PlatformSmsIntegrationTest {

    private static final List<String> QUERIES = new ArrayList<>();
    private static final HttpServer SERVER;

    static {
        try {
            SERVER = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            SERVER.createContext("/", exchange -> {
                QUERIES.add(URLDecoder.decode(exchange.getRequestURI().getRawQuery(), StandardCharsets.UTF_8));
                byte[] body = "{\"response_type\":\"MESSAGE\",\"message_id\":\"9\"}".getBytes(StandardCharsets.UTF_8);
                // ca SMSLink-ul real: JSON trimis cu Content-Type text/html
                exchange.getResponseHeaders().add("Content-Type", "text/html; charset=iso-8859-1");
                exchange.sendResponseHeaders(200, body.length);
                try (OutputStream out = exchange.getResponseBody()) {
                    out.write(body);
                }
            });
            SERVER.start();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("smslink.url", () -> "http://127.0.0.1:" + SERVER.getAddress().getPort() + "/json.php");
        r.add("platform.smslink.connection-id", () -> "PLATCONN");
        r.add("platform.smslink.password", () -> "platpass");
    }

    @AfterAll
    static void stop() {
        SERVER.stop(0);
    }

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private SmsSender smsSender;
    @Autowired private SmsQuotaService quota;
    @Autowired private PasswordEncoder encoder;

    @Test
    void platformSmsUseThePlatformAccountAndStopAtThePlan() {
        AppUser station = users.save(AppUser.builder().email("q1@itp.ro").password("x").role(Role.MANAGER)
                .autoSmsProvider(SmsProvider.PLATFORM).smsPlan(300).build());
        smsSender.send(station, "0722 111 222", "Scurt");
        assertThat(QUERIES.get(QUERIES.size() - 1)).contains("connection_id=PLATCONN").contains("password=platpass");
        // un mesaj lung se taxeaza ca doua SMS-uri
        smsSender.send(station, "0722 111 222", "a".repeat(200));
        assertThat(quota.usedThisMonth(station.getId())).isEqualTo(3);

        quota.record(station, 296);
        smsSender.send(station, "0722 111 222", "ultimul");
        assertThatThrownBy(() -> smsSender.send(station, "0722 111 222", "peste cota"))
                .isInstanceOf(DeliveryException.class).hasMessageContaining("300 / 300");

        AppUser noPlan = users.save(AppUser.builder().email("q2@itp.ro").password("x").role(Role.MANAGER)
                .autoSmsProvider(SmsProvider.PLATFORM).build());
        assertThatThrownBy(() -> smsSender.send(noPlan, "0722 111 222", "x")).hasMessageContaining("pachet");
    }

    @Test
    void adminSetsThePlanAndTheStationSeesItsUsage() throws Exception {
        AppUser station = users.save(AppUser.builder().email("q3@itp.ro").password(encoder.encode("secret12")).role(Role.MANAGER).build());
        String admin = login("admin@itp.ro", "admin-test-pass");
        String manager = login("q3@itp.ro", "secret12");

        // fara pachet nu se poate alege canalul
        mvc.perform(put("/api/account/auto-sms").header("Authorization", "Bearer " + manager).contentType(MediaType.APPLICATION_JSON)
                .content("{\"enabled\":true,\"provider\":\"PLATFORM\"}")).andExpect(status().isBadRequest());

        mvc.perform(put("/api/admin/managers/" + station.getId() + "/sms-plan").header("Authorization", "Bearer " + admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"plan\":123}")).andExpect(status().isBadRequest());
        mvc.perform(put("/api/admin/managers/" + station.getId() + "/sms-plan").header("Authorization", "Bearer " + admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"plan\":600}")).andExpect(status().isNoContent());

        mvc.perform(put("/api/account/auto-sms").header("Authorization", "Bearer " + manager).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true,\"provider\":\"PLATFORM\",\"apptConfirmSms\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.platformAvailable").value(true))
                .andExpect(jsonPath("$.smsPlan").value(600))
                .andExpect(jsonPath("$.smsUsedThisMonth").value(0));
        mvc.perform(get("/api/admin/managers").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.email == 'q3@itp.ro')].smsPlan").value(600));
    }

    private String login(String email, String password) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }
}
