package org.example.easyitp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Appointment;
import org.example.easyitp.entity.AppointmentSource;
import org.example.easyitp.entity.AppointmentStatus;
import org.example.easyitp.entity.Role;
import org.example.easyitp.entity.SmsProvider;
import org.example.easyitp.entity.VehicleCategory;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.AppointmentRepository;
import org.example.easyitp.service.AppointmentSmsService;
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
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// C3: confirmare SMS, link pentru anulare/mutare, reminder cu o zi inainte, neprezentari. Trimiterea SMS e un mock.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AppointmentSelfServiceIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private AppointmentRepository appointments;
    @Autowired private AppointmentSmsService appointmentSmsService;
    @Autowired private PasswordEncoder encoder;
    @MockBean private SmsSender smsSender;

    private AppUser station;
    private LocalDate day;

    @BeforeEach
    void setUp() {
        station = users.save(AppUser.builder().email("p1@itp.ro").password(encoder.encode("secret12")).role(Role.MANAGER)
                .stationName("ITP Programari").address("Str. Test 1").bookingEnabled(true).bookingSlug("itp-programari")
                .autoSmsProvider(SmsProvider.SMS_GATE).smsGateUsername("u").smsGatePassword("p")
                .apptConfirmSms(true).apptReminderSms(true).build());
        when(smsSender.send(any(), anyString(), anyString())).thenReturn("id");
        day = LocalDate.now().plusDays(3);
        while (day.getDayOfWeek().getValue() > 5 || org.example.easyitp.service.RomanianHolidays.nameOf(day) != null) day = day.plusDays(1);
    }

    @Test
    void onlineBookingIsConfirmedAndCanBeMovedOrCancelledFromTheLink() throws Exception {
        String token = book("09:00");
        verify(smsSender).send(any(), eq("0722 444 555"), argThat(t -> t.startsWith("ITP Programari: programare ITP confirmata")
                && t.contains("ora 09:00") && t.contains("/p/" + token)));

        mvc.perform(get("/api/public/appointments/" + token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.stationName").value("ITP Programari"))
                .andExpect(jsonPath("$.canChange").value(true));

        // o alta programare ocupa 10:00 pe singura linie -> nu se poate muta acolo
        book("10:00");
        JsonNode slots = json.readTree(mvc.perform(get("/api/public/appointments/" + token + "/slots?date=" + day))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(slots.toString()).contains("09:00").doesNotContain("\"10:00");
        mvc.perform(post("/api/public/appointments/" + token + "/reschedule").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("appointmentDate", day + "T10:00")))).andExpect(status().isConflict());

        mvc.perform(post("/api/public/appointments/" + token + "/reschedule").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("appointmentDate", day + "T11:00"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.clientAction").value("RESCHEDULED"));
        assertThat(appointments.findByManageToken(token).orElseThrow().getAppointmentDate()).isEqualTo(day.atTime(11, 0));
        verify(smsSender).send(any(), anyString(), argThat(t -> t.contains("ora 11:00")));

        mvc.perform(post("/api/public/appointments/" + token + "/cancel")).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED")).andExpect(jsonPath("$.canChange").value(false));
        mvc.perform(post("/api/public/appointments/" + token + "/cancel")).andExpect(status().isConflict());
        mvc.perform(get("/api/public/appointments/nu-exista-token")).andExpect(status().isNotFound());
    }

    @Test
    void tooLateToChangeOnline() throws Exception {
        Appointment soon = appointments.save(Appointment.builder().user(station).clientName("Grabit").phone("0722 000 111")
                .appointmentDate(LocalDateTime.now().plusMinutes(30)).status(AppointmentStatus.SCHEDULED)
                .source(AppointmentSource.ONLINE).vehicleCategory(VehicleCategory.CAR).build());
        mvc.perform(post("/api/public/appointments/" + soon.getManageToken() + "/cancel")).andExpect(status().isConflict());
        mvc.perform(get("/api/public/appointments/" + soon.getManageToken())).andExpect(jsonPath("$.canChange").value(false));
    }

    @Test
    void dayBeforeReminderGoesOutOnceAndSaturdayCoversMonday() {
        LocalDate saturday = LocalDate.now().plusDays(1);
        while (saturday.getDayOfWeek() != DayOfWeek.SATURDAY) saturday = saturday.plusDays(1);
        LocalDate monday = saturday.plusDays(2);
        appt("Luni", "0722 100 100", monday.atTime(9, 0), AppointmentStatus.SCHEDULED);
        appt("Anulat", "0722 100 101", monday.atTime(10, 0), AppointmentStatus.CANCELLED);
        appt("Fix", "0264 100 102", monday.atTime(11, 0), AppointmentStatus.SCHEDULED);
        appt("Marti", "0722 100 103", monday.plusDays(1).atTime(9, 0), AppointmentStatus.SCHEDULED);

        assertThat(appointmentSmsService.runDayBefore(saturday).sent()).isEqualTo(1);
        verify(smsSender).send(any(), eq("0722 100 100"), argThat(t -> t.contains("va asteptam la ITP luni")
                && t.contains("Adresa: Str. Test 1")));
        assertThat(appointmentSmsService.runDayBefore(saturday).sent()).isZero();
        verify(smsSender, times(1)).send(any(), anyString(), anyString());
        verify(smsSender, never()).send(any(), eq("0722 100 103"), anyString());
    }

    @Test
    void noShowsAreCountedInReports() throws Exception {
        String manager = login();
        LocalDate past = LocalDate.now().withDayOfMonth(1);
        Appointment a = appt("Absent", "0722 200 200", past.atTime(9, 0), AppointmentStatus.SCHEDULED);
        appt("Venit", "0722 200 201", past.atTime(10, 0), AppointmentStatus.COMPLETED);
        mvc.perform(put("/api/appointments/" + a.getId()).header("Authorization", "Bearer " + manager)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                        "clientName", "Absent", "phone", "0722 200 200", "appointmentDate", past.atTime(9, 0).toString(),
                        "status", "NO_SHOW")))).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("NO_SHOW"));

        JsonNode stats = json.readTree(mvc.perform(get("/api/reports?year=" + past.getYear()).header("Authorization", "Bearer " + manager))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("appointments");
        assertThat(stats.get("total").asLong()).isEqualTo(2);
        assertThat(stats.get("noShow").asLong()).isEqualTo(1);
        assertThat(stats.get("completed").asLong()).isEqualTo(1);
    }

    // ---------- ajutatoare ----------

    private String book(String time) throws Exception {
        Map<String, Object> body = Map.of("clientName", "Ana Client", "phone", "0722 444 555", "licensePlate", "CJ01PRG",
                "appointmentDate", day + "T" + time, "vehicleCategory", "CAR");
        String res = mvc.perform(post("/api/public/stations/itp-programari/appointments").header("CF-Connecting-IP", "10.5.5." + time.charAt(1))
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(res).get("manageToken").asText();
    }

    private Appointment appt(String name, String phone, LocalDateTime when, AppointmentStatus st) {
        return appointments.save(Appointment.builder().user(station).clientName(name).phone(phone).appointmentDate(when)
                .status(st).source(AppointmentSource.MANUAL).vehicleCategory(VehicleCategory.CAR).build());
    }

    private String login() throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"p1@itp.ro\",\"password\":\"secret12\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }
}
