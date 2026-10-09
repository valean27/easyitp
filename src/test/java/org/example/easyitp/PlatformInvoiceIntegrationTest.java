package org.example.easyitp;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Payment;
import org.example.easyitp.entity.PaymentStatus;
import org.example.easyitp.entity.Plan;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.PaymentRepository;
import org.example.easyitp.repository.PlatformSettingsRepository;
import org.example.easyitp.service.DeliveryException;
import org.example.easyitp.service.FgoClient;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Facturarea abonamentelor prin FGO din pagina adminului: setarile (cheia nu se intoarce), emiterea din lista de plati
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class PlatformInvoiceIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private PaymentRepository payments;
    @Autowired private PlatformSettingsRepository settings;
    @Autowired private PasswordEncoder encoder;
    @MockBean private FgoClient fgo;

    private String admin;
    private AppUser station;

    @BeforeEach
    void setUp() throws Exception {
        settings.deleteAll();
        users.save(AppUser.builder().email("admin-fgo@itp.ro").password(encoder.encode("secret12")).role(Role.ADMIN).build());
        admin = json.readTree(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"admin-fgo@itp.ro\",\"password\":\"secret12\"}")).andReturn().getResponse().getContentAsString())
                .get("token").asText();
        station = users.save(AppUser.builder().email("statie-fgo@itp.ro").password("x").role(Role.MANAGER).stationName("ITP Fgo")
                .billingName("ITP Fgo SRL").billingCui("RO123456").billingAddress("Str. Lungă 1").billingCity("Baia Mare")
                .billingCounty("Maramureș").build());
    }

    @Test
    void settingsKeepTheKeySecret() throws Exception {
        mvc.perform(get("/api/admin/platform-invoicing").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.configured").value(false)).andExpect(jsonPath("$.hasKey").value(false));
        save("{\"cui\":\"ro48267925\",\"key\":\" cheie-secreta \",\"series\":\"eitp\",\"test\":true,\"markPaid\":true,\"paymentType\":\"Card\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cui").value("RO48267925"))
                .andExpect(jsonPath("$.series").value("EITP"))
                .andExpect(jsonPath("$.hasKey").value(true))
                .andExpect(jsonPath("$.configured").value(true))
                .andExpect(jsonPath("$.key").doesNotExist());
        // cheia sta criptata in baza de date
        assertThat(settings.findAll().get(0).getFgoKey()).startsWith("v1:").doesNotContain("cheie-secreta");
        // fara cheie in cerere, ramane cea veche
        save("{\"cui\":\"RO48267925\",\"series\":\"EITP\",\"test\":false}").andExpect(jsonPath("$.hasKey").value(true));
        save("{\"cui\":\"abc\",\"series\":\"EITP\"}").andExpect(status().isBadRequest());

        when(fgo.probe(anyString(), anyString(), anyString(), anyString(), anyString())).thenReturn("Factura nu exista");
        mvc.perform(post("/api/admin/platform-invoicing/test").header("Authorization", "Bearer " + admin))
                .andExpect(jsonPath("$.message").value("Factura nu exista"));
        verify(fgo).probe(eq(FgoClient.PRODUCTION), eq("RO48267925"), eq("cheie-secreta"), anyString(), eq("EITP"));

        // doar adminul
        AppUser manager = users.save(AppUser.builder().email("m-fgo@itp.ro").password(encoder.encode("secret12")).role(Role.MANAGER).build());
        String token = json.readTree(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"m-fgo@itp.ro\",\"password\":\"secret12\"}")).andReturn().getResponse().getContentAsString()).get("token").asText();
        assertThat(manager.getId()).isNotNull();
        mvc.perform(get("/api/admin/platform-invoicing").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }

    @Test
    @SuppressWarnings("unchecked")
    void adminIssuesTheInvoiceOfAPaidPayment() throws Exception {
        Payment p = payments.save(Payment.builder().userId(station.getId()).orderId("EI99-test0001").plan(Plan.PRO).smsPlan(300).months(12)
                .amount(new BigDecimal("2780.00")).status(PaymentStatus.PAID).createdAt(LocalDateTime.now())
                .paidAt(LocalDateTime.of(2026, 10, 9, 14, 0)).planUntil(LocalDate.of(2027, 10, 9)).build());

        // fara FGO setat: nu se poate emite
        issue(p).andExpect(status().isBadRequest());

        save("{\"cui\":\"RO48267925\",\"key\":\"cheie\",\"series\":\"EITP\",\"markPaid\":true,\"paymentType\":\"Card\"}").andExpect(status().isOk());
        when(fgo.issue(anyString(), anyString(), anyString(), anyString(), anyMap()))
                .thenThrow(new DeliveryException("FGO: Judetul nu exista"))
                .thenReturn(new FgoClient.Issued("EITP", "12", "https://fgo.ro/f/12.pdf"));

        // prima data FGO refuza: eroarea ramane pe plata
        issue(p).andExpect(status().isOk()).andExpect(jsonPath("$.invoiceError").value("FGO: Judetul nu exista"))
                .andExpect(jsonPath("$.payment.invoiceNumber").doesNotExist());
        // a doua oara merge; incasarea se inregistreaza
        issue(p).andExpect(status().isOk()).andExpect(jsonPath("$.payment.invoiceNumber").value("EITP 12"))
                .andExpect(jsonPath("$.payment.invoiceLink").value("https://fgo.ro/f/12.pdf"))
                .andExpect(jsonPath("$.invoiceError").doesNotExist());
        // deja facturata: nu se dubleaza
        issue(p).andExpect(status().isConflict());

        ArgumentCaptor<Map<String, Object>> body = ArgumentCaptor.forClass(Map.class);
        verify(fgo, times(2)).issue(eq(FgoClient.PRODUCTION), eq("RO48267925"), eq("cheie"), anyString(), body.capture());
        Map<String, Object> sent = body.getValue();
        assertThat(sent).containsEntry("Serie", "EITP").containsEntry("IdExtern", "EI99-test0001").containsEntry("VerificareDuplicat", true);
        Map<String, Object> client = (Map<String, Object>) sent.get("Client");
        assertThat(client).containsEntry("Denumire", "ITP Fgo SRL").containsEntry("CodUnic", "RO123456").containsEntry("Tip", "PJ")
                .containsEntry("Judet", "Maramures").containsEntry("Localitate", "Baia Mare").containsEntry("PlatitorTVA", true);
        List<Map<String, Object>> lines = (List<Map<String, Object>>) sent.get("Continut");
        // 12 luni platite ca 10: Pro 59 x 10 + SMS 300 (119) x 10 = 2780, cat s-a platit
        assertThat(lines).hasSize(2);
        assertThat(((BigDecimal) lines.get(0).get("PretTotal")).intValue()).isEqualTo(590);
        assertThat(((BigDecimal) lines.get(1).get("PretTotal")).intValue()).isEqualTo(1190);
        assertThat(lines.get(0).get("CotaTVA")).isEqualTo(21);
        verify(fgo).markPaid(anyString(), anyString(), anyString(), anyString(), any(), eq("Card"), eq("2780.00"), eq("2026-10-09 14:00:00"));
    }

    private org.springframework.test.web.servlet.ResultActions save(String body) throws Exception {
        return mvc.perform(put("/api/admin/platform-invoicing").header("Authorization", "Bearer " + admin)
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private org.springframework.test.web.servlet.ResultActions issue(Payment p) throws Exception {
        return mvc.perform(post("/api/admin/payments/" + p.getOrderId() + "/invoice").header("Authorization", "Bearer " + admin));
    }
}
