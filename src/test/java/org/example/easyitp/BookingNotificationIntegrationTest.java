package org.example.easyitp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.service.EmailService;
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

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Emailul optional la programarea online: confirmarea clientului (cu Google Calendar si .ics), emailul managerului
// si notificarile din aplicatie (programare noua, mutata, anulata de client)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class BookingNotificationIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private PasswordEncoder encoder;
    @MockBean private EmailService emailService;

    private String token;
    private final LocalDate day = LocalDate.now().plusDays(3);

    @BeforeEach
    void setUp() throws Exception {
        when(emailService.isConfigured()).thenReturn(true);
        users.save(AppUser.builder().email("notif@itp.ro").password(encoder.encode("secret12")).role(Role.MANAGER)
                .stationName("ITP Notificări").address("Str. Lungă 1, Cluj").phone("0264 111 222").build());
        token = json.readTree(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"notif@itp.ro\",\"password\":\"secret12\"}")).andReturn().getResponse().getContentAsString()).get("token").asText();
        mvc.perform(put("/api/account/booking").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true,\"slug\":\"notif\",\"open\":\"08:00\",\"close\":\"17:00\",\"days\":[1,2,3,4,5,6,7],\"capacity\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emailNotify").value(true));
    }

    @Test
    void bookingWithEmailSendsConfirmationsAndNotifies() throws Exception {
        // email gresit -> campul marcat
        book("10:00", "nu-e-email", "10.1.1.1").andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("email"));

        String manage = json.readTree(book("10:00", " Ion.Pop@Exemplu.ro ", "10.1.1.2").andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("manageToken").asText();

        ArgumentCaptor<String> to = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> subject = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> html = ArgumentCaptor.forClass(String.class);
        verify(emailService, times(2)).send(to.capture(), subject.capture(), html.capture());
        assertThat(to.getAllValues()).containsExactly("ion.pop@exemplu.ro", "notif@itp.ro");
        assertThat(subject.getAllValues().get(0)).contains("confirmată").contains("ITP Notificări");
        assertThat(html.getAllValues().get(0)).contains("calendar.google.com/calendar/render").contains("/calendar.ics")
                .contains("/p/" + manage).contains("ora 10:00");
        assertThat(subject.getAllValues().get(1)).startsWith("Programare nouă online: Ion Pop");

        // fisierul de calendar
        String ics = mvc.perform(get("/api/public/appointments/" + manage + "/calendar.ics"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("programare-itp.ics")))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(ics).contains("BEGIN:VEVENT").contains("SUMMARY:ITP la ITP Notificări").contains("LOCATION:Str. Lungă 1\\, Cluj")
                .contains("DTSTART:" + day.toString().replace("-", "") + "T0").contains("END:VCALENDAR");

        // notificarea din aplicatie
        JsonNode inbox = getJson("/api/notifications");
        assertThat(inbox.get("unread").asLong()).isEqualTo(1);
        assertThat(inbox.get("items").get(0).get("kind").asText()).isEqualTo("NEW_BOOKING");
        assertThat(inbox.get("items").get(0).get("link").asText()).isEqualTo("/calendar?date=" + day);

        // clientul o anuleaza: email la amandoi + notificare
        reset(emailService);
        when(emailService.isConfigured()).thenReturn(true);
        mvc.perform(post("/api/public/appointments/" + manage + "/cancel")).andExpect(status().isOk());
        verify(emailService, times(2)).send(anyString(), subject.capture(), anyString());
        assertThat(subject.getAllValues().subList(subject.getAllValues().size() - 2, subject.getAllValues().size()))
                .anyMatch(s -> s.contains("anulată"));
        assertThat(getJson("/api/notifications").get("unread").asLong()).isEqualTo(2);
        mvc.perform(get("/api/public/appointments/" + manage + "/calendar.ics")).andExpect(status().isNotFound());

        // citite
        mvc.perform(post("/api/notifications/read-all").header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());
        assertThat(getJson("/api/notifications/unread-count").get("unread").asLong()).isZero();
    }

    @Test
    void withoutEmailOnlyTheManagerIsWrittenAndHeCanTurnItOff() throws Exception {
        book("11:00", null, "10.1.2.1").andExpect(status().isCreated());
        verify(emailService, times(1)).send(eq("notif@itp.ro"), anyString(), anyString());

        mvc.perform(put("/api/account/booking").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true,\"slug\":\"notif\",\"open\":\"08:00\",\"close\":\"17:00\",\"days\":[1,2,3,4,5,6,7],\"capacity\":1,\"emailNotify\":false}"))
                .andExpect(jsonPath("$.emailNotify").value(false));
        reset(emailService);
        when(emailService.isConfigured()).thenReturn(true);
        book("12:00", null, "10.1.2.2").andExpect(status().isCreated());
        verify(emailService, never()).send(anyString(), anyString(), anyString());
        // notificarea din aplicatie ramane
        assertThat(getJson("/api/notifications").get("unread").asLong()).isEqualTo(2);
    }

    private org.springframework.test.web.servlet.ResultActions book(String time, String email, String ip) throws Exception {
        var body = new java.util.LinkedHashMap<String, Object>();
        body.put("clientName", "Ion Pop");
        body.put("phone", "0722 111 222");
        body.put("licensePlate", "CJ01NOT");
        body.put("appointmentDate", day + "T" + time + ":00");
        if (email != null) body.put("email", email);
        return mvc.perform(post("/api/public/stations/notif/appointments").header("CF-Connecting-IP", ip)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }

    private JsonNode getJson(String url) throws Exception {
        return json.readTree(mvc.perform(get(url).header("Authorization", "Bearer " + token)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }
}
