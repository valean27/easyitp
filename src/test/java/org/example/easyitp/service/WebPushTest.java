package org.example.easyitp.service;

import org.junit.jupiter.api.Test;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.time.Instant;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Criptarea Web Push verificata din partea browserului (decriptare dupa RFC 8291) si semnatura VAPID
class WebPushTest {

    @Test
    void browserCanDecryptTheMessage() throws Exception {
        KeyPair browser = WebPush.generateKeyPair();
        byte[] uaPublic = WebPush.encode((ECPublicKey) browser.getPublic());
        byte[] auth = new byte[16];
        new SecureRandom().nextBytes(auth);
        String message = "{\"title\":\"Programare nouă\",\"body\":\"Azi · 10:00 · CJ 01 ABC\"}";

        byte[] body = WebPush.encrypt(message.getBytes(StandardCharsets.UTF_8), uaPublic, auth);

        // antetul aes128gcm: salt (16) | rs (4) | idlen (1) | cheia efemera (65)
        ByteBuffer buf = ByteBuffer.wrap(body);
        byte[] salt = new byte[16];
        buf.get(salt);
        assertThat(buf.getInt()).isEqualTo(4096);
        int idLen = buf.get();
        assertThat(idLen).isEqualTo(65);
        byte[] asPublic = new byte[idLen];
        buf.get(asPublic);
        byte[] ciphertext = Arrays.copyOfRange(body, buf.position(), body.length);

        KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
        agreement.init(browser.getPrivate());
        agreement.doPhase(WebPush.publicKey(asPublic), true);
        WebPush.Keys keys = WebPush.deriveKeys(agreement.generateSecret(), auth, uaPublic, asPublic, salt);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(keys.cek(), "AES"), new GCMParameterSpec(128, keys.nonce()));
        byte[] padded = cipher.doFinal(ciphertext);

        assertThat(padded[padded.length - 1]).isEqualTo((byte) 2);
        assertThat(new String(padded, 0, padded.length - 1, StandardCharsets.UTF_8)).isEqualTo(message);
    }

    @Test
    void derivationMatchesRfc8291Example() throws Exception {
        // RFC 8291, anexa A: cheile si sarea din exemplu dau aceeasi cheie de continut si acelasi nonce
        byte[] uaPublic = WebPush.unb64("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4");
        byte[] asPrivate = WebPush.unb64("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw");
        byte[] asPublic = WebPush.unb64("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8");
        byte[] auth = WebPush.unb64("BTBZMqHH6r4Tts7J_aSIgg");
        byte[] salt = WebPush.unb64("DGv6ra1nlYgDCS1FRnbzlw");

        KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
        agreement.init(WebPush.privateKey(asPrivate));
        agreement.doPhase(WebPush.publicKey(uaPublic), true);
        WebPush.Keys keys = WebPush.deriveKeys(agreement.generateSecret(), auth, uaPublic, asPublic, salt);

        assertThat(WebPush.b64(keys.cek())).isEqualTo("oIhVW04MRdy2XN9CiKLxTg");
        assertThat(WebPush.b64(keys.nonce())).isEqualTo("4h_95klXJ5E_qnoN");
    }

    @Test
    void vapidHeaderIsSignedForThePushServiceOrigin() throws Exception {
        KeyPair server = WebPush.generateKeyPair();
        String pub = WebPush.b64(WebPush.encode((ECPublicKey) server.getPublic()));
        // cheia privata trece prin forma base64url (cum sta in mediu) si inapoi
        ECPrivateKey priv = WebPush.privateKey(WebPush.unb64(WebPush.b64(WebPush.encode((ECPrivateKey) server.getPrivate()))));

        String header = WebPush.vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc:def", priv, pub,
                "mailto:contact@easyitp.ro", Instant.ofEpochSecond(1_800_000_000L));

        assertThat(header).startsWith("vapid t=").endsWith(", k=" + pub);
        String jwt = header.substring("vapid t=".length(), header.indexOf(','));
        String[] parts = jwt.split("\\.");
        String claims = new String(WebPush.unb64(parts[1]), StandardCharsets.UTF_8);
        assertThat(claims).contains("\"aud\":\"https://fcm.googleapis.com\"").contains("\"exp\":1800043200")
                .contains("\"sub\":\"mailto:contact@easyitp.ro\"");
        Signature verifier = Signature.getInstance("SHA256withECDSAinP1363Format");
        verifier.initVerify(server.getPublic());
        verifier.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        assertThat(verifier.verify(WebPush.unb64(parts[2]))).isTrue();
    }

    @Test
    void pushIsOnOnlyWithAMatchingKeyPair() throws Exception {
        KeyPair a = WebPush.generateKeyPair();
        KeyPair b = WebPush.generateKeyPair();
        String pubA = WebPush.b64(WebPush.encode((ECPublicKey) a.getPublic()));
        String privA = WebPush.b64(WebPush.encode((ECPrivateKey) a.getPrivate()));
        String privB = WebPush.b64(WebPush.encode((ECPrivateKey) b.getPrivate()));
        assertThat(new PushService(null, null, null, null, pubA, privA, "mailto:x@y.ro", false).available()).isTrue();
        assertThat(new PushService(null, null, null, null, pubA, privB, "mailto:x@y.ro", false).available()).isFalse();
        assertThat(new PushService(null, null, null, null, pubA, privB, "mailto:x@y.ro", false).publicKey()).isNull();
        assertThat(new PushService(null, null, null, null, "", "", "mailto:x@y.ro", false).available()).isFalse();
        assertThat(new PushService(null, null, null, null, "nu-e-cheie", privA, "mailto:x@y.ro", false).available()).isFalse();
    }

    @Test
    void rejectsBadKeysAndForeignEndpoints() {
        assertThatThrownBy(() -> WebPush.publicKey(new byte[10])).isInstanceOf(java.security.GeneralSecurityException.class);
        assertThat(PushService.pushHost("https://fcm.googleapis.com/fcm/send/x")).isTrue();
        assertThat(PushService.pushHost("https://updates.push.services.mozilla.com/wpush/v2/x")).isTrue();
        assertThat(PushService.pushHost("https://web.push.apple.com/abc")).isTrue();
        assertThat(PushService.pushHost("https://wns2-par02p.notify.windows.com/w/?token=x")).isTrue();
        assertThat(PushService.pushHost("http://fcm.googleapis.com/x")).isFalse();
        assertThat(PushService.pushHost("https://localhost/x")).isFalse();
        assertThat(PushService.pushHost("https://fcm.googleapis.com.evil.ro/x")).isFalse();
        assertThat(PushService.pushHost("https://evilfcm.googleapis.com/x")).isFalse();
        assertThat(PushService.pushHost("https://user@fcm.googleapis.com/x")).isFalse();
    }
}
