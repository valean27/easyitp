package org.example.easyitp;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.LeadRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Cererile de demonstratie din pagina de prezentare
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class LeadIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private LeadRepository leads;
    @Autowired private AppUserRepository users;
    @Autowired private PasswordEncoder encoder;

    @Test
    void visitorsCanAskForADemoAndOnlyTheAdminSeesIt() throws Exception {
        submit(Map.of("name", "Maria Pop", "station", "ITP Nord", "city", "Cluj", "phone", "0722 123 456"), "10.1.1.1")
                .andExpect(status().isCreated());
        // bot: campul capcana completat -> raspuns de succes, dar nimic salvat
        submit(Map.of("name", "Bot", "phone", "0722 123 456", "website", "spam.example"), "10.1.1.2").andExpect(status().isCreated());
        submit(Map.of("name", "Fara contact"), "10.1.1.3")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").isNotEmpty());
        assertThat(leads.count()).isEqualTo(1);

        String admin = login("admin@itp.ro", "admin-test-pass");
        mvc.perform(get("/api/admin/leads").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].station").value("ITP Nord"));
        users.save(AppUser.builder().email("l1@itp.ro").password(encoder.encode("secret12")).role(Role.MANAGER).build());
        mvc.perform(get("/api/admin/leads").header("Authorization", "Bearer " + login("l1@itp.ro", "secret12")))
                .andExpect(status().isForbidden());
    }

    @Test
    void tooManyRequestsFromOneAddressAreRefused() throws Exception {
        for (int i = 0; i < 3; i++) {
            submit(Map.of("name", "Ion " + i, "email", "ion" + i + "@test.ro"), "10.2.2.2").andExpect(status().isCreated());
        }
        submit(Map.of("name", "Ion 4", "email", "ion4@test.ro"), "10.2.2.2").andExpect(status().isTooManyRequests());
    }

    private org.springframework.test.web.servlet.ResultActions submit(Map<String, String> body, String ip) throws Exception {
        return mvc.perform(post("/api/public/leads").header("CF-Connecting-IP", ip)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }

    private String login(String email, String password) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }
}
