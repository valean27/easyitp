package org.example.easyitp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.service.AutoReminderService;
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
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Alte scadente (C4): RCA / rovinieta / tahograf in formular si in fisa, in "De contactat", in SMS-urile automate
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class DeadlineIntegrationTest {

    private static final String PASSWORD = "secret12";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private AutoReminderService autoReminderService;
    @Autowired private PasswordEncoder encoder;
    @MockBean private SmsSender smsSender;

    private final LocalDate today = LocalDate.now();
    private String manager;
    private String other;

    @BeforeEach
    void setUp() throws Exception {
        users.save(AppUser.builder().email("d1@itp.ro").password(encoder.encode(PASSWORD)).role(Role.MANAGER)
                .stationName("ITP Nord").phone("0722 999 999").build());
        users.save(AppUser.builder().email("d2@itp.ro").password(encoder.encode(PASSWORD)).role(Role.MANAGER).build());
        manager = login("d1@itp.ro");
        other = login("d2@itp.ro");
        when(smsSender.send(any(), anyString(), anyString())).thenReturn("id-1");
    }

    @Test
    void deadlinesFromTheItpFormShowUpInTheClientFileAndInTheContactList() throws Exception {
        itp("Ana RCA", "0722 000 001", "CJ01RCA", true, Map.of("RCA", today.plusDays(10).toString(),
                "ROVINIETA", today.plusDays(200).toString()));

        assertThat(getJson("/api/itp/deadlines?plate=cj 01 rca", manager).get("RCA").asText())
                .isEqualTo(today.plusDays(10).toString());
        assertThat(getJson("/api/itp/deadlines?plate=CJ01RCA", other).size()).isZero();

        JsonNode list = getJson("/api/reminders/deadlines", manager);
        assertThat(list).hasSize(1); // rovinieta expira peste 200 de zile: nu e de contactat
        JsonNode rca = list.get(0);
        assertThat(rca.get("kind").asText()).isEqualTo("RCA");
        assertThat(rca.get("daysLeft").asLong()).isEqualTo(10);
        assertThat(rca.get("clientName").asText()).isEqualTo("Ana RCA");
        assertThat(getJson("/api/reminders/deadlines", other)).isEmpty();

        // bifa "Contactat", apoi o data noua o sterge
        long vehicleId = rca.get("vehicleId").asLong();
        send(put("/api/reminders/deadlines/" + vehicleId + "/RCA"), Map.of("contacted", true), other).andExpect(status().isNotFound());
        send(put("/api/reminders/deadlines/" + vehicleId + "/RCA"), Map.of("contacted", true), manager).andExpect(status().isNoContent());
        assertThat(getJson("/api/reminders/deadlines", manager).get(0).get("contactedAt").isNull()).isFalse();

        long clientId = getJson("/api/clients?q=ana", manager).get("items").get(0).get("id").asLong();
        Map<String, Object> deadlines = new HashMap<>();
        deadlines.put("RCA", today.plusDays(12).toString());
        deadlines.put("ROVINIETA", null);
        Map<String, Object> body = new LinkedHashMap<>(Map.of("licensePlate", "CJ01RCA", "brand", "Dacia"));
        body.put("deadlines", deadlines);
        JsonNode file = json.readTree(send(put("/api/clients/vehicles/" + vehicleId), body, manager)
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
        JsonNode car = file.get("vehicles").get(0).get("deadlines");
        assertThat(car.get("RCA").asText()).isEqualTo(today.plusDays(12).toString());
        assertThat(car.has("ROVINIETA")).isFalse();
        assertThat(getJson("/api/reminders/deadlines", manager).get(0).get("contactedAt").isNull()).isTrue();
        assertThat(getJson("/api/clients/" + clientId, manager).get("vehicles").get(0).get("deadlines").get("RCA").asText())
                .isEqualTo(today.plusDays(12).toString());

        // un ITP nou fara scadente nu le sterge; data invalida -> 400
        itp("Ana RCA", "0722 000 001", "CJ01RCA", true, null);
        assertThat(getJson("/api/itp/deadlines?plate=CJ01RCA", manager).get("RCA").asText()).isEqualTo(today.plusDays(12).toString());
        Map<String, Object> bad = new LinkedHashMap<>(Map.of("licensePlate", "CJ01RCA", "brand", "Dacia",
                "deadlines", Map.of("TAHOGRAF", "1990-01-01")));
        send(put("/api/clients/vehicles/" + vehicleId), bad, manager).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Data pentru Tahograf nu este validă"));

        // schimbarile apar in istoric
        JsonNode history = getJson("/api/history", manager).get("items");
        boolean logged = false;
        for (JsonNode e : history) {
            if (e.get("entityType").asText().equals("VEHICLE") && e.get("changes").asText().contains("Rovinietă:")) logged = true;
        }
        assertThat(logged).isTrue();
    }

    @Test
    void automaticSmsGoesSevenDaysBeforeOnlyOnceAndSkipsContactedOnes() throws Exception {
        itp("Ion Sms", "0722 000 002", "CJ02SMS", true, Map.of("RCA", today.plusDays(6).toString()));
        itp("Dan Sunat", "0722 000 003", "CJ03SUN", true, Map.of("TAHOGRAF", today.plusDays(5).toString()));
        itp("Fara Acord", "0722 000 004", "CJ04NOA", null, Map.of("ROVINIETA", today.plusDays(4).toString()));
        itp("Prea Devreme", "0722 000 005", "CJ05EAR", true, Map.of("RCA", today.plusDays(20).toString()));
        long called = 0;
        for (JsonNode d : getJson("/api/reminders/deadlines", manager)) {
            if (d.get("plate").asText().equals("CJ03SUN")) called = d.get("vehicleId").asLong();
        }
        send(put("/api/reminders/deadlines/" + called + "/TAHOGRAF"), Map.of("contacted", true), manager).andExpect(status().isNoContent());

        // oprit: nimic
        enable(false);
        assertThat(autoReminderService.runDaily(today).sent()).isZero();

        enable(true);
        assertThat(autoReminderService.runDaily(today).sent()).isEqualTo(1);
        verify(smsSender).send(any(), eq("0722 000 002"), argThat(t -> t.startsWith("ITP Nord: RCA pentru CJ02SMS expira pe")
                && t.contains("/s/")));
        verify(smsSender, never()).send(any(), eq("0722 000 003"), anyString());
        verify(smsSender, never()).send(any(), eq("0722 000 004"), anyString());
        assertThat(autoReminderService.runDaily(today.plusDays(1)).sent()).isZero();

        JsonNode log = getJson("/api/account/auto-sms/log", manager);
        assertThat(log.get(0).get("kind").asText()).isEqualTo("RCA");
        assertThat(log.get(0).get("plate").asText()).isEqualTo("CJ02SMS");
        assertThat(getJson("/api/account/auto-sms", manager).get("deadlinesSms").asBoolean()).isTrue();
        for (JsonNode d : getJson("/api/reminders/deadlines", manager)) {
            assertThat(d.get("autoSmsAt").isNull()).isEqualTo(!d.get("plate").asText().equals("CJ02SMS"));
        }
    }

    @Test
    void undoingADeleteBringsTheDeadlinesBack() throws Exception {
        itp("Maria Undo", "0722 000 006", "CJ06UND", true, Map.of("RCA", today.plusDays(9).toString()));
        long clientId = getJson("/api/clients?q=maria", manager).get("items").get(0).get("id").asLong();
        String eventId = mvc.perform(delete("/api/clients/" + clientId).header("Authorization", "Bearer " + manager))
                .andReturn().getResponse().getHeader("X-Audit-Event");
        assertThat(getJson("/api/reminders/deadlines", manager)).isEmpty();
        mvc.perform(post("/api/history/" + eventId + "/undo").header("Authorization", "Bearer " + manager))
                .andExpect(status().isOk());
        assertThat(getJson("/api/itp/deadlines?plate=CJ06UND", manager).get("RCA").asText()).isEqualTo(today.plusDays(9).toString());
    }

    // ---------- ajutatoare ----------

    private void enable(boolean deadlines) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("enabled", true);
        body.put("provider", "SMS_GATE");
        body.put("smsGateUsername", "GWUSER");
        body.put("smsGatePassword", "parola-gw");
        body.put("days", java.util.List.of(30));
        body.put("deadlinesSms", deadlines);
        send(put("/api/account/auto-sms"), body, manager).andExpect(status().isOk());
    }

    private void itp(String name, String phone, String plate, Boolean consent, Map<String, String> deadlines) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("phone", phone);
        body.put("brand", "Dacia");
        body.put("licensePlate", plate);
        body.put("testDate", today.minusDays(1).toString());
        body.put("validityMonths", 12);
        if (consent != null) body.put("reminderConsent", consent);
        if (deadlines != null) body.put("deadlines", deadlines);
        send(post("/api/itp"), body, manager).andExpect(status().isCreated());
    }

    private String login(String email) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    private JsonNode getJson(String url, String token) throws Exception {
        String body = mvc.perform(get(url).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return json.readTree(body);
    }

    private ResultActions send(MockHttpServletRequestBuilder request, Object body, String token) throws Exception {
        return mvc.perform(request.header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }
}
