package org.example.easyitp;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Plan;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.service.EmailService;
import org.example.easyitp.service.PlanNoticeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Emailurile despre cont: bun venit cu confirmarea adresei, "Am uitat parola" (link valabil o data, sesiunile vechi
// inchise) si anunturile despre expirarea probei / abonamentului. Emailurile sunt prinse de un EmailService simulat.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AccountEmailIntegrationTest {

    private static final Pattern TOKEN = Pattern.compile("\\?token=([A-Za-z0-9_-]+)");

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private PasswordEncoder encoder;
    @Autowired private PlanNoticeService planNoticeService;
    @MockBean private EmailService emailService;

    @BeforeEach
    void setUp() {
        when(emailService.isConfigured()).thenReturn(true);
    }

    @Test
    void signupSendsWelcomeAndTheLinkConfirmsTheEmailOnce() throws Exception {
        String res = mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                        "stationName", "ITP Mail", "city", "Cluj", "phone", "0745123456", "email", "mail@itp.ro",
                        "password", "parola123", "acceptTerms", true))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String token = json.readTree(res).get("token").asText();
        mvc.perform(get("/api/account/me").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.emailVerified").value(false));

        String link = sentLink("mail@itp.ro");
        assertThat(link).contains("/confirmare-email?token=");
        mvc.perform(post("/api/auth/verify-email").contentType(MediaType.APPLICATION_JSON).content(body("token", extract(link))))
                .andExpect(status().isOk());
        mvc.perform(get("/api/account/me").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.emailVerified").value(true));
        // a doua oara, acelasi link nu mai merge
        mvc.perform(post("/api/auth/verify-email").contentType(MediaType.APPLICATION_JSON).content(body("token", extract(link))))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/account/resend-verification").header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void forgotPasswordResetsOnceAndClosesOldSessions() throws Exception {
        users.save(AppUser.builder().email("reset@itp.ro").password(encoder.encode("veche123")).role(Role.MANAGER).build());
        String oldSession = login("reset@itp.ro", "veche123");

        // email fara cont: acelasi raspuns, nimic trimis
        mvc.perform(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON).content(body("email", "nimeni@itp.ro")))
                .andExpect(status().isOk());
        verify(emailService, never()).send(eq("nimeni@itp.ro"), anyString(), anyString());

        mvc.perform(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON).content(body("email", " Reset@ITP.ro ")))
                .andExpect(status().isOk());
        String link = sentLink("reset@itp.ro");
        assertThat(link).contains("/resetare-parola?token=");
        String token = extract(link);

        mvc.perform(post("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("token", token, "password", "scurt"))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("password"));
        mvc.perform(post("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("token", token, "password", "noua12345"))))
                .andExpect(status().isOk());
        // linkul merge o singura data
        mvc.perform(post("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("token", token, "password", "alta12345"))))
                .andExpect(status().isBadRequest());

        login("reset@itp.ro", "noua12345");
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", "reset@itp.ro", "password", "veche123"))))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/account/me").header("Authorization", "Bearer " + oldSession)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("token", "inventat", "password", "alta12345"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void expiryNoticesGoOncePerStage() {
        LocalDate today = LocalDate.of(2026, 10, 6);
        users.save(AppUser.builder().email("proba@itp.ro").password("x").role(Role.MANAGER)
                .plan(Plan.PREMIUM).planUntil(today.plusDays(2)).planTrial(true).build());
        users.save(AppUser.builder().email("expirat@itp.ro").password("x").role(Role.MANAGER)
                .plan(Plan.PRO).planUntil(today.minusDays(1)).planTrial(false).build());
        users.save(AppUser.builder().email("departe@itp.ro").password("x").role(Role.MANAGER)
                .plan(Plan.PRO).planUntil(today.plusDays(20)).build());
        users.save(AppUser.builder().email("vechi2@itp.ro").password("x").role(Role.MANAGER).build());

        planNoticeService.runDaily(today);
        verify(emailService).send(eq("proba@itp.ro"), eq("Easy ITP – perioada de probă se încheie pe 08.10.2026"), anyString());
        verify(emailService).send(eq("expirat@itp.ro"), eq("Easy ITP – abonamentul a expirat"), anyString());
        verify(emailService, never()).send(eq("departe@itp.ro"), anyString(), anyString());
        verify(emailService, never()).send(eq("vechi2@itp.ro"), anyString(), anyString());

        // a doua zi: nimic nou pentru aceleasi etape
        clearInvocations(emailService);
        planNoticeService.runDaily(today.plusDays(1));
        verify(emailService, never()).send(eq("proba@itp.ro"), anyString(), anyString());
        verify(emailService, never()).send(eq("expirat@itp.ro"), anyString(), anyString());

        // proba expira -> un singur anunt "s-a incheiat"
        planNoticeService.runDaily(today.plusDays(3));
        planNoticeService.runDaily(today.plusDays(4));
        verify(emailService, times(1)).send(eq("proba@itp.ro"), eq("Easy ITP – perioada de probă s-a încheiat"), anyString());
    }

    private String sentLink(String to) {
        ArgumentCaptor<String> html = ArgumentCaptor.forClass(String.class);
        verify(emailService, org.mockito.Mockito.atLeastOnce()).send(eq(to), anyString(), html.capture());
        List<String> all = html.getAllValues();
        Matcher m = Pattern.compile("href=\"([^\"]+)\"").matcher(all.get(all.size() - 1));
        assertThat(m.find()).isTrue();
        return m.group(1).replace("&amp;", "&");
    }

    private static String extract(String link) {
        Matcher m = TOKEN.matcher(link);
        assertThat(m.find()).isTrue();
        return m.group(1);
    }

    private String body(String key, String value) throws Exception {
        return json.writeValueAsString(Map.of(key, value));
    }

    private String login(String email, String password) throws Exception {
        String res = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", email, "password", password))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(res).get("token").asText();
    }
}
