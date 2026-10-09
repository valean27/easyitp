package org.example.easyitp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.PushSubscription;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.PushSubscriptionRepository;
import org.example.easyitp.service.PushGateway;
import org.example.easyitp.service.WebPush;
import org.junit.jupiter.api.AfterEach;
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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.ByteBuffer;
import java.security.KeyPair;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Notificarile push: abonarea unui browser, trimiterea dupa o programare online (managerului si inspectorului liniei),
// stergerea abonamentelor expirate. Fara @Transactional: push-ul pleaca abia dupa salvarea tranzactiei.
@SpringBootTest(properties = "push.async=false")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PushIntegrationTest {

    private static final KeyPair SERVER;

    static {
        try {
            SERVER = WebPush.generateKeyPair();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void vapid(DynamicPropertyRegistry registry) {
        registry.add("push.vapid.public-key", () -> WebPush.b64(WebPush.encode((ECPublicKey) SERVER.getPublic())));
        registry.add("push.vapid.private-key", () -> WebPush.b64(WebPush.encode((ECPrivateKey) SERVER.getPrivate())));
    }

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private PushSubscriptionRepository subscriptions;
    @Autowired private PasswordEncoder encoder;
    @MockBean private PushGateway gateway;

    private String token;
    private String slug;
    private AppUser station;
    private static int bookings;

    @BeforeEach
    void setUp() throws Exception {
        String id = UUID.randomUUID().toString().substring(0, 8);
        slug = "push-" + id;
        station = users.save(AppUser.builder().email("push-" + id + "@itp.ro").password(encoder.encode("secret12"))
                .role(Role.MANAGER).stationName("ITP Push").build());
        token = json.readTree(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + station.getEmail() + "\",\"password\":\"secret12\"}")).andReturn().getResponse()
                .getContentAsString()).get("token").asText();
        mvc.perform(put("/api/account/booking").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true,\"slug\":\"" + slug + "\",\"open\":\"08:00\",\"close\":\"17:00\","
                                + "\"days\":[1,2,3,4,5,6,7],\"capacity\":1,\"holidaysClosed\":false}"))
                .andExpect(status().isOk());
        when(gateway.post(anyString(), anyMap(), any())).thenReturn(201);
    }

    // Testul nu ruleaza intr-o tranzactie (datele raman): statia iese din lista publica, ca sa nu incurce alte teste
    @AfterEach
    void hideStation() {
        users.findById(station.getId()).ifPresent(u -> {
            u.setBookingEnabled(false);
            u.setPublicListing(false);
            users.save(u);
        });
    }

    @Test
    void managerSubscribesAndGetsOnlineBookings() throws Exception {
        mvc.perform(get("/api/push/status").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.devices").value(0));

        Browser phone = new Browser("https://fcm.googleapis.com/fcm/send/" + slug);
        subscribe(phone).andExpect(status().isOk()).andExpect(jsonPath("$.devices").value(1));
        // aceeasi abonare inca o data nu dubleaza dispozitivul
        subscribe(phone).andExpect(jsonPath("$.devices").value(1));
        // adrese care nu sunt servicii de push sau chei stricate: refuzate
        subscribe(new Browser("http://127.0.0.1:8080/x")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/push/subscribe").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endpoint\":\"https://fcm.googleapis.com/fcm/send/x\",\"keys\":{\"p256dh\":\"abc\",\"auth\":\"def\"}}"))
                .andExpect(status().isBadRequest());

        LocalDate day = LocalDate.now().plusDays(5);
        book(day, "10:00").andExpect(status().isCreated());

        ArgumentCaptor<byte[]> body = ArgumentCaptor.forClass(byte[].class);
        ArgumentCaptor<Map<String, String>> headers = mapCaptor();
        verify(gateway).post(eq(phone.endpoint), headers.capture(), body.capture());
        assertThat(headers.getValue().get("Content-Encoding")).isEqualTo("aes128gcm");
        assertThat(headers.getValue().get("Authorization")).startsWith("vapid t=");
        JsonNode message = json.readTree(phone.decrypt(body.getValue()));
        assertThat(message.get("title").asText()).contains("Ion Pop");
        assertThat(message.get("url").asText()).isEqualTo("/calendar?date=" + day);

        // proba din Contul meu
        mvc.perform(post("/api/push/test").header("Authorization", "Bearer " + token)).andExpect(jsonPath("$.devices").value(1));
        verify(gateway, times(2)).post(eq(phone.endpoint), anyMap(), any());

        // serviciul de push spune ca abonamentul nu mai exista: se sterge
        when(gateway.post(anyString(), anyMap(), any())).thenReturn(410);
        mvc.perform(post("/api/push/test").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        assertThat(subscriptions.findByEndpoint(phone.endpoint)).isEmpty();
    }

    @Test
    void lineInspectorHearsAboutTomorrowAndOldSessionsStopReceiving() throws Exception {
        long inspectorId = json.readTree(mvc.perform(post("/api/inspectors").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Ana Pop\",\"defaultLine\":1}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
        AppUser account = users.save(AppUser.builder().email("ana.pop@" + slug).password("x").role(Role.INSPECTOR)
                .inspectorId(inspectorId).build());
        Browser inspectorPhone = new Browser("https://web.push.apple.com/" + slug);
        subscriptions.save(PushSubscription.builder().userId(account.getId()).endpoint(inspectorPhone.endpoint)
                .p256dh(WebPush.b64(inspectorPhone.publicKey)).auth(WebPush.b64(inspectorPhone.auth))
                .tokenVersion(0).createdAt(LocalDateTime.now()).build());

        // peste 5 zile: doar managerul (fara abonament aici), inspectorul nu
        book(LocalDate.now().plusDays(5), "09:00").andExpect(status().isCreated());
        verify(gateway, never()).post(eq(inspectorPhone.endpoint), anyMap(), any());

        // maine, pe linia lui: afla
        book(LocalDate.now().plusDays(1), "10:00").andExpect(status().isCreated());
        ArgumentCaptor<byte[]> body = ArgumentCaptor.forClass(byte[].class);
        verify(gateway).post(eq(inspectorPhone.endpoint), anyMap(), body.capture());
        JsonNode message = json.readTree(inspectorPhone.decrypt(body.getValue()));
        assertThat(message.get("body").asText()).startsWith("Mâine · ");
        assertThat(message.get("url").asText()).isEqualTo("/");

        // parola schimbata (sesiunile vechi revocate): abonamentul nu mai primeste nimic si dispare
        account.revokeTokens();
        users.save(account);
        book(LocalDate.now().plusDays(1), "11:00").andExpect(status().isCreated());
        verify(gateway, times(1)).post(eq(inspectorPhone.endpoint), anyMap(), any());
        assertThat(subscriptions.findByEndpoint(inspectorPhone.endpoint)).isEmpty();
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static ArgumentCaptor<Map<String, String>> mapCaptor() {
        return (ArgumentCaptor) ArgumentCaptor.forClass(Map.class);
    }

    private org.springframework.test.web.servlet.ResultActions subscribe(Browser b) throws Exception {
        return mvc.perform(post("/api/push/subscribe").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("endpoint", b.endpoint,
                        "keys", Map.of("p256dh", WebPush.b64(b.publicKey), "auth", WebPush.b64(b.auth))))));
    }

    // statia lucreaza si de sarbatori (holidaysClosed=false), deci orice zi merge; fiecare cerere de pe alt IP (limita pe IP)
    private org.springframework.test.web.servlet.ResultActions book(LocalDate day, String time) throws Exception {
        return mvc.perform(post("/api/public/stations/" + slug + "/appointments").header("CF-Connecting-IP", "10.9." + (++bookings) + ".1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("clientName", "Ion Pop", "phone", "0722 111 222", "licensePlate", "CJ01PSH",
                        "appointmentDate", day + "T" + time + ":00", "vehicleCategory", "CAR"))));
    }

    // Un browser abonat: cheile lui si decriptarea ca in browser (RFC 8291)
    private static final class Browser {
        final String endpoint;
        final KeyPair keys;
        final byte[] publicKey;
        final byte[] auth = new byte[16];

        Browser(String endpoint) throws Exception {
            this.endpoint = endpoint;
            this.keys = WebPush.generateKeyPair();
            this.publicKey = WebPush.encode((ECPublicKey) keys.getPublic());
            new java.security.SecureRandom().nextBytes(auth);
        }

        String decrypt(byte[] body) throws Exception {
            ByteBuffer buf = ByteBuffer.wrap(body);
            byte[] salt = new byte[16];
            buf.get(salt);
            buf.getInt();
            byte[] asPublic = new byte[buf.get()];
            buf.get(asPublic);
            byte[] ciphertext = java.util.Arrays.copyOfRange(body, buf.position(), body.length);
            javax.crypto.KeyAgreement agreement = javax.crypto.KeyAgreement.getInstance("ECDH");
            agreement.init(keys.getPrivate());
            agreement.doPhase(WebPush.publicKey(asPublic), true);
            var k = TestKeys.derive(agreement.generateSecret(), auth, publicKey, asPublic, salt);
            javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(javax.crypto.Cipher.DECRYPT_MODE, new javax.crypto.spec.SecretKeySpec(k[0], "AES"),
                    new javax.crypto.spec.GCMParameterSpec(128, k[1]));
            byte[] padded = cipher.doFinal(ciphertext);
            return new String(padded, 0, padded.length - 1, java.nio.charset.StandardCharsets.UTF_8);
        }
    }

    // Derivarea cheilor (RFC 8291), scrisa aici separat de cod, ca testul sa nu se bazeze pe aceeasi implementare
    private static final class TestKeys {
        static byte[][] derive(byte[] ecdh, byte[] auth, byte[] ua, byte[] as, byte[] salt) throws Exception {
            byte[] prkKey = hmac(auth, ecdh);
            byte[] ikm = hmac(prkKey, cat("WebPush: info\0".getBytes(java.nio.charset.StandardCharsets.US_ASCII), ua, as, new byte[]{1}));
            byte[] prk = hmac(salt, ikm);
            byte[] cek = java.util.Arrays.copyOf(hmac(prk, "Content-Encoding: aes128gcm\0\1".getBytes(java.nio.charset.StandardCharsets.US_ASCII)), 16);
            byte[] nonce = java.util.Arrays.copyOf(hmac(prk, "Content-Encoding: nonce\0\1".getBytes(java.nio.charset.StandardCharsets.US_ASCII)), 12);
            return new byte[][]{cek, nonce};
        }

        static byte[] hmac(byte[] key, byte[] data) throws Exception {
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(data);
        }

        static byte[] cat(byte[]... parts) {
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            for (byte[] p : parts) out.writeBytes(p);
            return out.toByteArray();
        }
    }
}
