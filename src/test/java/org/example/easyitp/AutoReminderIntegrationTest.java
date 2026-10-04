package org.example.easyitp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Appointment;
import org.example.easyitp.entity.AppointmentStatus;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.AppointmentRepository;
import org.example.easyitp.service.AutoReminderService;
import org.example.easyitp.service.DeliveryException;
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
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Remindere SMS automate (C2): cine primeste, cand, o singura data; setarile si jurnalul. Trimiterea reala e un mock.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AutoReminderIntegrationTest {

    private static final String PASSWORD = "secret12";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private AppointmentRepository appointments;
    @Autowired private AutoReminderService autoReminderService;
    @Autowired private PasswordEncoder encoder;
    @MockBean private SmsSender smsSender;

    private final LocalDate today = LocalDate.now();
    private String manager;
    private AppUser station;

    @BeforeEach
    void setUp() throws Exception {
        station = users.save(AppUser.builder().email("s1@itp.ro").password(encoder.encode(PASSWORD)).role(Role.MANAGER)
                .stationName("ITP Șoseaua Nouă").phone("0722 999 999").build());
        manager = login();
        when(smsSender.send(any(), anyString(), anyString())).thenReturn("id-1");
    }

    @Test
    void sendsOnlyToConsentingClientsAtTheirStageAndOnlyOnce() throws Exception {
        enable(Map.of());
        itp("Acord 30", "0722 000 030", "CJ30AAA", 30, true);
        itp("Fara acord", "0722 000 031", "CJ31BBB", 29, null);
        itp("Prea devreme", "0722 000 020", "CJ20CCC", 20, true);
        itp("Acord 7", "0722 000 007", "CJ07DDD", 6, true);
        itp("Fix", "0264 000 005", "CJ05EEE", 5, true);

        AutoReminderService.RunResult first = autoReminderService.runDaily(today);
        assertThat(first.sent()).isEqualTo(2);
        verify(smsSender).send(any(), eq("0722 000 030"), argThat(t -> t.contains("CJ30AAA") && t.contains("/stop/")
                && t.startsWith("ITP Soseaua Noua:")));
        verify(smsSender).send(any(), eq("0722 000 007"), anyString());
        verify(smsSender, never()).send(any(), eq("0722 000 031"), anyString());

        // a doua rulare in aceeasi zi (sau a doua zi, aceeasi treapta) nu mai trimite
        assertThat(autoReminderService.runDaily(today).sent()).isZero();
        assertThat(autoReminderService.runDaily(today.plusDays(1)).sent()).isZero();

        JsonNode reminders = getJson("/api/reminders");
        for (JsonNode r : reminders) {
            boolean sent = r.get("numarInmatriculare").asText().equals("CJ30AAA") || r.get("numarInmatriculare").asText().equals("CJ07DDD");
            assertThat(r.get("autoSmsAt").isNull()).isEqualTo(!sent);
        }
        JsonNode log = getJson("/api/account/auto-sms/log");
        assertThat(log).hasSize(2);
        assertThat(log.get(0).get("status").asText()).isEqualTo("SENT");
    }

    @Test
    void failedSendsAreRetriedOnTheNextRunsThenGivenUp() throws Exception {
        enable(Map.of());
        itp("Esec", "0722 000 040", "CJ40FAI", 28, true);
        reset(smsSender);
        when(smsSender.send(any(), anyString(), anyString())).thenThrow(new DeliveryException("Serverul SMS Gateway nu răspunde."));

        assertThat(autoReminderService.runDaily(today).failed()).isEqualTo(1);
        assertThat(autoReminderService.runDaily(today.plusDays(1)).failed()).isEqualTo(1);
        assertThat(autoReminderService.runDaily(today.plusDays(2)).failed()).isEqualTo(1);
        // dupa 3 incercari nu mai insista
        assertThat(autoReminderService.runDaily(today.plusDays(3)).failed()).isZero();
        verify(smsSender, times(3)).send(any(), anyString(), anyString());
        assertThat(getJson("/api/account/auto-sms/log").get(0).get("error").asText()).contains("nu răspunde");
    }

    @Test
    void clientsWhoAlreadyBookedOrDeclinedGetNothing() throws Exception {
        enable(Map.of());
        itp("Programat", "0722 000 050", "CJ50PRG", 27, true);
        appointments.save(Appointment.builder().user(station).clientName("Programat").licensePlate("cj 50 prg")
                .appointmentDate(today.plusDays(3).atTime(9, 0)).status(AppointmentStatus.SCHEDULED).build());
        itp("Stop", "0722 000 051", "CJ51STP", 27, true);
        String token = null;
        for (JsonNode r : getJson("/api/reminders")) if (r.get("numarInmatriculare").asText().equals("CJ51STP")) token = r.get("stopToken").asText();
        mvc.perform(post("/api/public/stop/" + token)).andExpect(status().isOk());

        assertThat(autoReminderService.runDaily(today).sent()).isZero();
        verify(smsSender, never()).send(any(), anyString(), anyString());
    }

    @Test
    void disabledStationsSendNothingAndSettingsNeverReturnPasswords() throws Exception {
        itp("Oprit", "0722 000 060", "CJ60OFF", 30, true);
        assertThat(autoReminderService.runDaily(today).sent()).isZero();

        // pornire fara credentiale -> 400
        Map<String, Object> missing = new LinkedHashMap<>(Map.of("enabled", true, "provider", "SMSLINK"));
        send(put("/api/account/auto-sms"), missing).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Introduceți Connection ID și parola conexiunii SMSLink."));
        Map<String, Object> badUrl = new LinkedHashMap<>(Map.of("enabled", false, "provider", "SMS_GATE",
                "smsGateUrl", "http://10.0.0.1"));
        send(put("/api/account/auto-sms"), badUrl).andExpect(status().isBadRequest());

        enable(Map.of("days", List.of(14, 3), "template", "{statie}: ITP {numar} pe {data}."));
        JsonNode settings = getJson("/api/account/auto-sms");
        assertThat(settings.get("smsGatePassword").isNull()).isTrue();
        assertThat(settings.get("hasSmsGatePassword").asBoolean()).isTrue();
        assertThat(settings.get("days").toString()).isEqualTo("[14,3]");
        // salvare fara parola -> se pastreaza cea veche
        enable(Map.of("smsGatePassword", ""));
        assertThat(users.findById(station.getId()).orElseThrow().getSmsGatePassword()).isEqualTo("parola-gw");

        send(post("/api/account/auto-sms/test"), Map.of()).andExpect(status().isOk());
        verify(smsSender).send(any(), eq("0722 999 999"), argThat(t -> t.startsWith("[Test]")));
    }

    // ---------- ajutatoare ----------

    private void enable(Map<String, Object> extra) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("enabled", true);
        body.put("provider", "SMS_GATE");
        body.put("smsGateUsername", "GWUSER");
        body.put("smsGatePassword", "parola-gw");
        body.putAll(extra);
        send(put("/api/account/auto-sms"), body).andExpect(status().isOk());
    }

    // ITP cu valabilitate 12 luni care expira peste `daysLeft` zile
    private void itp(String name, String phone, String plate, int daysLeft, Boolean consent) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("phone", phone);
        body.put("brand", "Dacia");
        body.put("licensePlate", plate);
        body.put("testDate", today.plusDays(daysLeft).minusMonths(12).toString());
        body.put("validityMonths", 12);
        if (consent != null) body.put("reminderConsent", consent);
        send(post("/api/itp"), body).andExpect(status().isCreated());
    }

    private String login() throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"s1@itp.ro\",\"password\":\"" + PASSWORD + "\"}"))
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
