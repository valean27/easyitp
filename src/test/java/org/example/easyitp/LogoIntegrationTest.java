package org.example.easyitp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Logo-ul statiei si mesajul de pe pagina de programare
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class LogoIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private PasswordEncoder encoder;

    private String token;

    @BeforeEach
    void setUp() throws Exception {
        users.save(AppUser.builder().email("logo@itp.ro").password(encoder.encode("secret12")).role(Role.MANAGER).stationName("ITP Logo").build());
        token = json.readTree(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"logo@itp.ro\",\"password\":\"secret12\"}")).andReturn().getResponse().getContentAsString()).get("token").asText();
        mvc.perform(put("/api/account/booking").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true,\"slug\":\"logo-statie\",\"open\":\"08:00\",\"close\":\"17:00\",\"days\":[1,2,3,4,5,6,7],\"capacity\":1,"
                                + "\"bookingMessage\":\"  Veniți cu 10 minute înainte.  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bookingMessage").value("Veniți cu 10 minute înainte."));
    }

    private static byte[] png(int w, int h) throws Exception {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        var g = img.createGraphics();
        g.setColor(Color.BLUE);
        g.fillRect(0, 0, w / 2, h);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    private org.springframework.test.web.servlet.ResultActions upload(String name, String type, byte[] bytes) throws Exception {
        return mvc.perform(multipart(HttpMethod.PUT, "/api/account/logo").file(new MockMultipartFile("logo", name, type, bytes))
                .header("Authorization", "Bearer " + token));
    }

    @Test
    void logoIsResizedServedPubliclyAndShownOnTheBookingPage() throws Exception {
        String url = json.readTree(upload("logo.png", "image/png", png(1000, 500)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).get("logoUrl").asText();
        assertThat(url).matches("/api/public/logos/[A-Za-z0-9_-]+\\.png");

        byte[] served = mvc.perform(get(url))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("max-age=31536000")))
                .andReturn().getResponse().getContentAsByteArray();
        BufferedImage img = ImageIO.read(new ByteArrayInputStream(served));
        assertThat(img.getWidth()).isEqualTo(400);
        assertThat(img.getHeight()).isEqualTo(200);

        JsonNode station = json.readTree(mvc.perform(get("/api/public/stations/logo-statie")).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8));
        assertThat(station.get("logoUrl").asText()).isEqualTo(url);
        assertThat(station.get("bookingMessage").asText()).isEqualTo("Veniți cu 10 minute înainte.");
        assertThat(mvc.perform(get("/api/account/me").header("Authorization", "Bearer " + token)).andReturn().getResponse()
                .getContentAsString()).contains(url);
        assertThat(mvc.perform(get("/api/public/stations")).andReturn().getResponse().getContentAsString()).contains(url);

        // un logo nou are alt link; cel vechi nu mai merge
        String second = json.readTree(upload("logo.jpg", "image/jpeg", png(200, 200)).andReturn().getResponse().getContentAsString())
                .get("logoUrl").asText();
        assertThat(second).isNotEqualTo(url);
        mvc.perform(get(url)).andExpect(status().isNotFound());

        mvc.perform(delete("/api/account/logo").header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());
        mvc.perform(get(second)).andExpect(status().isNotFound());
        assertThat(json.readTree(mvc.perform(get("/api/public/stations/logo-statie")).andReturn().getResponse().getContentAsString())
                .get("logoUrl").isNull()).isTrue();
    }

    @Test
    void onlyRealImagesAreAccepted() throws Exception {
        upload("logo.svg", "image/svg+xml", "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>".getBytes())
                .andExpect(status().isBadRequest());
        upload("logo.png", "image/png", "nu e o imagine".getBytes()).andExpect(status().isBadRequest());
        upload("logo.png", "image/png", new byte[0]).andExpect(status().isBadRequest());
        // fara cont nu se poate schimba
        mvc.perform(multipart(HttpMethod.PUT, "/api/account/logo").file(new MockMultipartFile("logo", "l.png", "image/png", png(10, 10))))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/public/logos/inexistent123.png")).andExpect(status().isNotFound());
    }
}
