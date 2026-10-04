package org.example.easyitp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Lista publica de statii (/statii): doar statiile active, cu programare online, care nu au cerut sa fie ascunse
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class DirectoryIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private PasswordEncoder encoder;

    @Test
    void listsOnlyActiveBookableStationsThatAgreed() throws Exception {
        station("z@itp.ro", "Zeta ITP", true, "zeta-itp", null, true);
        station("a@itp.ro", "Alfa ITP", true, "alfa-itp", null, true);
        station("h@itp.ro", "Ascunsa", true, "ascunsa-itp", false, true);
        station("o@itp.ro", "Fara programare", false, "fara-itp", null, true);
        station("d@itp.ro", "Dezactivata", true, "dez-itp", null, false);

        assertThat(names()).containsExactly("Alfa ITP", "Zeta ITP");

        // statia isi poate scoate singura numele din lista
        String token = login("a@itp.ro");
        JsonNode settings = json.readTree(mvc.perform(get("/api/account/booking").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.publicListing").value(true))
                .andReturn().getResponse().getContentAsString());
        ((com.fasterxml.jackson.databind.node.ObjectNode) settings).put("publicListing", false);
        mvc.perform(put("/api/account/booking").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(settings.toString())).andExpect(status().isOk());
        assertThat(names()).containsExactly("Zeta ITP");
    }

    private List<String> names() throws Exception {
        JsonNode list = json.readTree(mvc.perform(get("/api/public/stations")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        List<String> names = new ArrayList<>();
        list.forEach(s -> names.add(s.get("name").asText()));
        return names;
    }

    private void station(String email, String name, boolean booking, String slug, Boolean listed, boolean active) {
        users.save(AppUser.builder().email(email).password(encoder.encode("secret12")).role(Role.MANAGER)
                .stationName(name).bookingEnabled(booking).bookingSlug(slug).publicListing(listed).active(active).build());
    }

    private String login(String email) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"secret12\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }
}
