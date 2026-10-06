package org.example.easyitp;

import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Appointment;
import org.example.easyitp.entity.AppointmentSource;
import org.example.easyitp.entity.AppointmentStatus;
import org.example.easyitp.entity.Client;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.entity.ItpStatus;
import org.example.easyitp.entity.Role;
import org.example.easyitp.entity.Vehicle;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.AppointmentRepository;
import org.example.easyitp.repository.ClientRepository;
import org.example.easyitp.repository.ItpRecordRepository;
import org.example.easyitp.repository.VehicleRepository;
import org.example.easyitp.service.DeliveryException;
import org.example.easyitp.service.DigestService;
import org.example.easyitp.service.EmailService;
import org.example.easyitp.service.WhatsAppService;
import org.example.easyitp.entity.DigestChannel;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Emailul zilnic; trimiterea reala (Resend) e inlocuita cu un mock
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class DigestIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private DigestService digestService;
    @Autowired private AppUserRepository users;
    @Autowired private AppointmentRepository appointments;
    @Autowired private ClientRepository clients;
    @Autowired private VehicleRepository vehicles;
    @Autowired private ItpRecordRepository records;
    @Autowired private PasswordEncoder encoder;
    @MockBean private EmailService emailService;
    @MockBean private WhatsAppService whatsAppService;

    private final LocalDate today = LocalDate.now();
    private AppUser busy;
    private AppUser idle;

    @BeforeEach
    void setUp() {
        busy = users.save(AppUser.builder().email("ocupat@itp.ro").password(encoder.encode("secret12"))
                .role(Role.MANAGER).stationName("ITP Ocupat").build());
        idle = users.save(AppUser.builder().email("liber@itp.ro").password("x").role(Role.MANAGER).build());

        appointment(busy, "<script>Ion</script>", today.atTime(10, 0), null);
        appointment(busy, "Ana Online", today.plusDays(2).atTime(9, 0), AppointmentSource.ONLINE);
        itp(busy, "Dan Expira", "CJ01EXP", today.minusMonths(12).plusDays(3));
    }

    @Test
    void digestListsAppointmentsOnlineBookingsAndClientsToContact() {
        DigestService.Digest digest = digestService.build(busy, today);

        assertThat(digest.empty()).isFalse();
        assertThat(digest.subject()).contains("1 programare azi").contains("1 programare online nouă").contains("1 de contactat");
        assertThat(digest.html())
                .contains("Programări azi (1)")
                .contains("Ana Online")
                .contains("Dan Expira")
                .contains("CJ01EXP")
                .contains("/reminders")
                // numele vine de la client, deci trebuie escapat
                .contains("&lt;script&gt;Ion&lt;/script&gt;")
                .doesNotContain("<script>");

        assertThat(digestService.build(idle, today).empty()).isTrue();
    }

    @Test
    void sendsOncePerDayOnlyToManagersWithSomethingToReport() {
        DigestService.Result first = digestService.sendDailyDigests(today);
        assertThat(first.sent()).isEqualTo(1);
        verify(emailService, times(1)).send(eq("ocupat@itp.ro"), anyString(), anyString());
        verify(emailService, never()).send(eq("liber@itp.ro"), anyString(), anyString());

        // a doua rulare in aceeasi zi nu mai trimite
        assertThat(digestService.sendDailyDigests(today).sent()).isZero();
        verify(emailService, times(1)).send(eq("ocupat@itp.ro"), anyString(), anyString());
    }

    @Test
    void aConcurrentRunThatAlreadyClaimedTheDayIsNotSentTwice() {
        // alta rulare (retry-ul din GitHub Actions) a rezervat deja ziua acestui manager
        assertThat(users.claimDigest(busy.getId(), today)).isEqualTo(1);
        assertThat(users.claimDigest(busy.getId(), today)).isZero();

        assertThat(digestService.sendDailyDigests(today).sent()).isZero();
        verify(emailService, never()).send(eq("ocupat@itp.ro"), anyString(), anyString());
    }

    @Test
    void respectsOptOutAndRetriesAfterFailure() {
        doThrow(new DeliveryException("Resend down")).when(emailService).send(anyString(), anyString(), anyString());
        assertThat(digestService.sendDailyDigests(today).failed()).isEqualTo(1);
        assertThat(users.findById(busy.getId()).orElseThrow().getLastDigestDate()).isNull();
        // ziua a fost eliberata: urmatoarea rulare reincearca
        assertThat(digestService.sendDailyDigests(today).failed()).isEqualTo(1);
        busy = users.findById(busy.getId()).orElseThrow();

        busy.setDigestEnabled(false);
        users.save(busy);
        assertThat(digestService.sendDailyDigests(today).failed()).isZero();
    }

    @Test
    void internalEndpointRequiresCronSecret() throws Exception {
        mvc.perform(post("/api/internal/daily-digest")).andExpect(status().isForbidden());
        mvc.perform(post("/api/internal/daily-digest").header("X-Cron-Secret", "gresit")).andExpect(status().isForbidden());
        mvc.perform(post("/api/internal/daily-digest").header("X-Cron-Secret", "test-cron-secret"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sent").value(1));
        // a doua declansare in aceeasi zi (ceasul aplicatiei sau GitHub) nu mai ruleaza nimic
        mvc.perform(post("/api/internal/daily-digest").header("X-Cron-Secret", "test-cron-secret"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sent").value(0));
    }

    @Test
    void testEmailReportsResendErrorsToTheManager() throws Exception {
        String token = com.jayway.jsonpath.JsonPath.read(mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"ocupat@itp.ro\",\"password\":\"secret12\"}"))
                .andReturn().getResponse().getContentAsString(), "$.token");

        mvc.perform(post("/api/account/digest/test").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        ArgumentCaptor<String> subject = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("ocupat@itp.ro"), subject.capture(), anyString());
        assertThat(subject.getValue()).startsWith("[Test]");

        doThrow(new DeliveryException("Cheia Resend este invalidă")).when(emailService).send(anyString(), anyString(), anyString());
        mvc.perform(post("/api/account/digest/test").header("Authorization", "Bearer " + token))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.message").value("Cheia Resend este invalidă"));
    }

    @Test
    void whatsappChannelSendsShortTextInsteadOfEmail() {
        busy.setDigestChannel(DigestChannel.WHATSAPP);
        busy.setWhatsappPhone("0744123456");
        busy.setCallmebotApiKey("key-1");
        users.save(busy);

        assertThat(digestService.sendDailyDigests(today).sent()).isEqualTo(1);
        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(whatsAppService).send(eq("0744123456"), eq("key-1"), text.capture());
        verify(emailService, never()).send(anyString(), anyString(), anyString());
        assertThat(text.getValue())
                .startsWith("*EasyITP · ITP Ocupat*")
                .contains("*Programări azi (1)*")
                .contains("Dan Expira")
                .contains("/reminders")
                .doesNotContain("<div").doesNotContain("<table"); // fara HTML in WhatsApp
    }

    @Test
    void digestSettingsValidateWhatsappAndNeverReturnTheKey() throws Exception {
        String token = login();
        mvc.perform(put("/api/account/digest").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true,\"channel\":\"WHATSAPP\",\"whatsappPhone\":\"0744123456\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("CallMeBot")));

        mvc.perform(put("/api/account/digest").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true,\"channel\":\"WHATSAPP\",\"whatsappPhone\":\"0744123456\",\"callmebotApiKey\":\"secret-key\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasApiKey").value(true))
                .andExpect(jsonPath("$.callmebotApiKey").doesNotExist());

        // salvare fara cheie noua: cheia existenta se pastreaza
        mvc.perform(put("/api/account/digest").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true,\"channel\":\"WHATSAPP\",\"whatsappPhone\":\"0744 999 888\"}"))
                .andExpect(status().isOk());
        AppUser saved = users.findById(busy.getId()).orElseThrow();
        assertThat(saved.getCallmebotApiKey()).isEqualTo("secret-key");
        assertThat(saved.getWhatsappPhone()).isEqualTo("0744 999 888");

        String body = mvc.perform(get("/api/account/digest").header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("secret-key");
    }

    private String login() throws Exception {
        return com.jayway.jsonpath.JsonPath.read(mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"ocupat@itp.ro\",\"password\":\"secret12\"}"))
                .andReturn().getResponse().getContentAsString(), "$.token");
    }

    private void appointment(AppUser user, String name, java.time.LocalDateTime when, AppointmentSource source) {
        appointments.save(Appointment.builder().clientName(name).appointmentDate(when)
                .status(AppointmentStatus.SCHEDULED).source(source).user(user).build());
    }

    private void itp(AppUser user, String name, String plate, LocalDate testDate) {
        Client client = clients.save(Client.builder().name(name).phone("0722000000").user(user).build());
        Vehicle vehicle = vehicles.save(Vehicle.builder().brand("Dacia").licensePlate(plate).client(client).build());
        records.save(ItpRecord.builder().vehicle(vehicle).testDate(testDate).validityMonths(12)
                .nextItpDate(testDate.plusMonths(12)).status(ItpStatus.PASSED).price(150.0).build());
    }
}
