package org.example.easyitp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.service.ReviewRequestService;
import org.example.easyitp.service.SmsSender;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
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
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Recenzii si vizibilitate (C5): linkurile statiei si SMS-ul cu cererea de recenzie dupa ITP
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ReviewIntegrationTest {

    private static final String PASSWORD = "secret12";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private ReviewRequestService reviewRequestService;
    @Autowired private PasswordEncoder encoder;
    @MockBean private SmsSender smsSender;

    private final LocalDate today = LocalDate.now();
    private String manager;

    @BeforeEach
    void setUp() throws Exception {
        users.save(AppUser.builder().email("r1@itp.ro").password(encoder.encode(PASSWORD)).role(Role.MANAGER)
                .stationName("ITP Sud").phone("0722 999 999").build());
        manager = login();
        when(smsSender.send(any(), anyString(), anyString())).thenReturn("id-1");
    }

    @Test
    void linksAreValidatedAndShownOnThePublicPages() throws Exception {
        send(put("/api/account/visibility"), visibility("g.page/r/abc123/review", "", "nu e un link", false))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Linkul pentru Facebook nu este valid."));
        send(put("/api/account/visibility"), visibility("g.page/r/abc123/review", "http://maps.app.goo.gl/xyz", "", false))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviewUrl").value("https://g.page/r/abc123/review"))
                .andExpect(jsonPath("$.mapsUrl").value("https://maps.app.goo.gl/xyz"))
                .andExpect(jsonPath("$.facebookUrl").doesNotExist());
        // SMS-ul de recenzie cere un canal SMS ales
        send(put("/api/account/visibility"), visibility("g.page/r/abc123/review", null, null, true))
                .andExpect(status().isBadRequest());
        assertThat(getJson("/api/account/me").get("reviewUrl").asText()).isEqualTo("https://g.page/r/abc123/review");

        send(put("/api/account/booking"), Map.of("enabled", true, "slug", "itp-sud", "open", "08:00", "close", "16:00",
                "days", List.of(1, 2, 3, 4, 5), "capacity", 1)).andExpect(status().isOk());
        mvc.perform(get("/api/public/stations/itp-sud")).andExpect(status().isOk())
                .andExpect(jsonPath("$.mapsUrl").value("https://maps.app.goo.gl/xyz"))
                .andExpect(jsonPath("$.reviewUrl").value("https://g.page/r/abc123/review"));
        mvc.perform(get("/api/public/stations")).andExpect(jsonPath("$[0].mapsUrl").value("https://maps.app.goo.gl/xyz"));
    }

    @Test
    void reviewSmsGoesTheMorningAfterAPassedItpOncePerClient() throws Exception {
        Map<String, Object> sms = new LinkedHashMap<>(Map.of("enabled", false, "provider", "SMS_GATE",
                "smsGateUsername", "GW", "smsGatePassword", "parola"));
        send(put("/api/account/auto-sms"), sms).andExpect(status().isOk());
        send(put("/api/account/visibility"), visibility("https://g.page/r/abc123/review", null, null, true))
                .andExpect(status().isOk());

        itp("Ana Multumita", "0722 000 001", "CJ01REV", 1, "PASSED", true);
        itp("Ana Multumita", "0722 000 001", "CJ02REV", 1, "PASSED", true); // a doua masina: un singur SMS
        itp("Dan Respins", "0722 000 002", "CJ03REV", 1, "FAILED", true);
        itp("Fara Acord", "0722 000 003", "CJ04REV", 1, "PASSED", null);
        itp("Azi", "0722 000 004", "CJ05REV", 0, "PASSED", true);

        assertThat(reviewRequestService.runDaily(today).sent()).isEqualTo(1);
        verify(smsSender).send(any(), eq("0722 000 001"), argThat(t -> t.startsWith("ITP Sud: Multumim")
                && t.contains("https://g.page/r/abc123/review") && t.contains("/s/")));
        verify(smsSender, never()).send(any(), eq("0722 000 002"), anyString());
        verify(smsSender, never()).send(any(), eq("0722 000 003"), anyString());
        verify(smsSender, never()).send(any(), eq("0722 000 004"), anyString());
        // a doua zi: ITP-ul de "azi" a devenit de ieri, dar Ana nu mai primeste
        assertThat(reviewRequestService.runDaily(today.plusDays(1)).sent()).isEqualTo(1);
        assertThat(reviewRequestService.runDaily(today.plusDays(1)).sent()).isZero();
    }

    // ---------- ajutatoare ----------

    private static Map<String, Object> visibility(String review, String maps, String facebook, boolean reviewSms) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("reviewUrl", review);
        body.put("mapsUrl", maps);
        body.put("facebookUrl", facebook);
        body.put("reviewSms", reviewSms);
        return body;
    }

    private void itp(String name, String phone, String plate, int daysAgo, String status, Boolean consent) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("phone", phone);
        body.put("brand", "Dacia");
        body.put("licensePlate", plate);
        body.put("testDate", today.minusDays(daysAgo).toString());
        body.put("validityMonths", 12);
        body.put("status", status);
        if (consent != null) body.put("reminderConsent", consent);
        send(post("/api/itp"), body).andExpect(status().isCreated());
    }

    private String login() throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"r1@itp.ro\",\"password\":\"" + PASSWORD + "\"}"))
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
}
