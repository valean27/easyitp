package org.example.easyitp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.service.DigestService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
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
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Termenele statiei (D1): lista, alerta dupa tip si rezumatul zilnic; fiecare statie isi vede doar termenele ei
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class StationDeadlineIntegrationTest {

    private static final String PASSWORD = "secret12";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private PasswordEncoder encoder;
    @Autowired private DigestService digestService;

    private final LocalDate today = LocalDate.now();
    private AppUser station;
    private String manager;
    private String other;

    @BeforeEach
    void setUp() throws Exception {
        station = users.save(AppUser.builder().email("t1@itp.ro").password(encoder.encode(PASSWORD)).role(Role.MANAGER)
                .stationName("ITP Termene").build());
        users.save(AppUser.builder().email("t2@itp.ro").password(encoder.encode(PASSWORD)).role(Role.MANAGER).build());
        manager = login("t1@itp.ro");
        other = login("t2@itp.ro");
    }

    @Test
    void deadlinesWarnByKindAndShowUpInTheDigest() throws Exception {
        // autorizatia RAR avertizeaza cu 60 de zile inainte, metrologia cu 30
        long rar = create("AUTORIZATIE_RAR", "Autorizația nr. 123", today.plusDays(50));
        create("METROLOGIE", "Banc de frânare", today.plusDays(50));
        create("ATESTAT_INSPECTOR", "Andrei M.", today.minusDays(2));

        JsonNode list = getJson("/api/station-deadlines", manager);
        assertThat(list).hasSize(3);
        assertThat(list.get(0).get("title").asText()).isEqualTo("Andrei M.");
        assertThat(list.get(0).get("due").asBoolean()).isTrue();
        for (JsonNode d : list) {
            if (d.get("kind").asText().equals("AUTORIZATIE_RAR")) assertThat(d.get("due").asBoolean()).isTrue();
            if (d.get("kind").asText().equals("METROLOGIE")) assertThat(d.get("due").asBoolean()).isFalse();
        }
        assertThat(getJson("/api/station-deadlines", other)).isEmpty();

        DigestService.Digest digest = digestService.build(station, today);
        assertThat(digest.empty()).isFalse();
        assertThat(digest.html()).contains("Termenele stației (2)").contains("Autorizația nr. 123").contains("expirat de 2 zile");
        assertThat(digest.text()).contains("Andrei M.");
        assertThat(digest.html()).doesNotContain("Banc de frânare");

        // reinnoita: data noua, iese din alerta; alta statie nu o poate modifica sau sterge
        Map<String, Object> renewed = body("AUTORIZATIE_RAR", "Autorizația nr. 123", today.plusYears(2));
        send(put("/api/station-deadlines/" + rar), renewed, other).andExpect(status().isNotFound());
        send(put("/api/station-deadlines/" + rar), renewed, manager).andExpect(status().isOk())
                .andExpect(jsonPath("$.due").value(false));
        mvc.perform(delete("/api/station-deadlines/" + rar).header("Authorization", "Bearer " + other))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/station-deadlines/" + rar).header("Authorization", "Bearer " + manager))
                .andExpect(status().isNoContent());
        assertThat(getJson("/api/station-deadlines", manager)).hasSize(2);
    }

    @Test
    void invalidInputIsRejected() throws Exception {
        Map<String, Object> noDate = new LinkedHashMap<>(Map.of("kind", "METROLOGIE"));
        send(post("/api/station-deadlines"), noDate, manager).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Introduceți data expirării."));
        send(post("/api/station-deadlines"), Map.of("dueDate", today.toString()), manager).andExpect(status().isBadRequest());
        send(post("/api/station-deadlines"), body("BOGUS", null, today), manager).andExpect(status().isBadRequest());
    }

    // ---------- ajutatoare ----------

    private long create(String kind, String title, LocalDate due) throws Exception {
        String res = send(post("/api/station-deadlines"), body(kind, title, due), manager).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return json.readTree(res).get("id").asLong();
    }

    private static Map<String, Object> body(String kind, String title, LocalDate due) {
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("kind", kind);
        b.put("title", title);
        b.put("dueDate", due.toString());
        return b;
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
