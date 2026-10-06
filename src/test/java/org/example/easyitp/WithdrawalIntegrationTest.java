package org.example.easyitp;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.WithdrawalRepository;
import org.example.easyitp.service.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Functia de retragere din contract: formular public validat pe campuri, salvare, confirmare pe email cu data,
// legatura cu contul cu acelasi email; doar adminul vede cererile
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class WithdrawalIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private WithdrawalRepository withdrawals;
    @MockBean private EmailService emailService;

    @BeforeEach
    void setUp() {
        when(emailService.isConfigured()).thenReturn(true);
    }

    @Test
    void withdrawalIsSavedAndConfirmedByEmail() throws Exception {
        AppUser station = users.save(AppUser.builder().email("plata@itp.ro").password("x").role(Role.MANAGER).build());

        mvc.perform(post("/api/public/withdrawal").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("name", "Ion Pop", "email", "nu-e-email", "contract", "abonament"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field").value("email"));
        mvc.perform(post("/api/public/withdrawal").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("name", "Ion Pop", "email", "Plata@ITP.ro", "contract", "Abonament Pro, octombrie"))))
                .andExpect(status().isCreated());

        assertThat(withdrawals.findAll()).singleElement().satisfies(w -> {
            assertThat(w.getEmail()).isEqualTo("plata@itp.ro");
            assertThat(w.getUserId()).isEqualTo(station.getId());
            assertThat(w.getHandled()).isFalse();
        });
        ArgumentCaptor<String> html = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("plata@itp.ro"), eq("Easy ITP – confirmarea primirii cererii de retragere"), html.capture());
        assertThat(html.getValue()).contains("Abonament Pro, octombrie").contains("Am primit pe");

        // bot: raspuns ca la succes, nimic salvat
        mvc.perform(post("/api/public/withdrawal").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("name", "Bot", "email", "b@b.ro", "contract", "x", "website", "spam"))))
                .andExpect(status().isCreated());
        assertThat(withdrawals.count()).isEqualTo(1);

        // lista e doar pentru admin
        mvc.perform(get("/api/admin/withdrawals")).andExpect(status().isUnauthorized());
        String admin = json.readTree(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"admin@itp.ro\",\"password\":\"admin-test-pass\"}")).andReturn().getResponse().getContentAsString())
                .get("token").asText();
        mvc.perform(get("/api/admin/withdrawals").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].contract").value("Abonament Pro, octombrie"));
        verify(emailService, org.mockito.Mockito.never()).send(eq("b@b.ro"), anyString(), anyString());
    }
}
