package org.example.easyitp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.PushSubscription;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.PushSubscriptionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import jakarta.annotation.PreDestroy;
import java.net.URI;
import java.security.GeneralSecurityException;
import java.security.interfaces.ECPrivateKey;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// Notificarile push pe telefon / calculator (Web Push cu VAPID). Fara cheile VAPID in mediu totul e oprit.
// Se trimit dupa ce tranzactia s-a salvat, pe un fir separat, ca o problema la Google / Apple sa nu incetineasca cererea.
@Slf4j
@Service
public class PushService {

    // Doar serviciile de push ale browserelor (nu orice adresa: serverul face cereri catre ea)
    private static final List<String> PUSH_HOSTS = List.of("fcm.googleapis.com", "push.services.mozilla.com",
            "notify.windows.com", "push.apple.com");
    static final int MAX_PER_ACCOUNT = 10;

    public record Message(String title, String body, String url, String tag) {
    }

    public record SubscribeRequest(String endpoint, Keys keys) {
        public record Keys(String p256dh, String auth) {
        }
    }

    private final PushSubscriptionRepository repository;
    private final AppUserRepository users;
    private final PushGateway gateway;
    private final ObjectMapper json;
    private final String publicKey;
    private final ECPrivateKey privateKey;
    private final String subject;
    private final boolean async;
    private final ExecutorService executor = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "push");
        t.setDaemon(true);
        return t;
    });

    public PushService(PushSubscriptionRepository repository, AppUserRepository users, PushGateway gateway, ObjectMapper json,
                       @Value("${push.vapid.public-key:}") String publicKey,
                       @Value("${push.vapid.private-key:}") String privateKey,
                       @Value("${push.vapid.subject:mailto:contact@easyitp.ro}") String subject,
                       @Value("${push.async:true}") boolean async) {
        this.repository = repository;
        this.users = users;
        this.gateway = gateway;
        this.json = json;
        this.subject = subject;
        this.async = async;
        ECPrivateKey key = null;
        String pub = null;
        if (!publicKey.isBlank() && !privateKey.isBlank()) {
            try {
                var pubKey = WebPush.publicKey(WebPush.unb64(publicKey));
                ECPrivateKey candidate = WebPush.privateKey(WebPush.unb64(privateKey));
                // cele doua chei trebuie sa fie o pereche (altfel serviciile de push refuza tot)
                java.security.Signature signer = java.security.Signature.getInstance("SHA256withECDSA");
                signer.initSign(candidate);
                signer.update(new byte[]{1});
                byte[] sig = signer.sign();
                signer.initVerify(pubKey);
                signer.update(new byte[]{1});
                if (!signer.verify(sig)) throw new GeneralSecurityException("cheia publica nu corespunde celei private");
                pub = WebPush.b64(WebPush.unb64(publicKey));
                key = candidate;
            } catch (GeneralSecurityException | IllegalArgumentException e) {
                pub = null;
                log.warn("Cheile VAPID nu sunt valide; notificarile push sunt oprite: {}", e.getMessage());
            }
        }
        this.privateKey = key;
        this.publicKey = pub;
    }

    @PreDestroy
    void stop() {
        executor.shutdown();
    }

    public boolean available() {
        return privateKey != null;
    }

    // Cheia publica pentru browser (null = push oprit)
    public String publicKey() {
        return publicKey;
    }

    // ---------- abonare ----------

    @Transactional
    public long subscribe(AppUser account, SubscribeRequest request, String userAgent) {
        if (!available()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Notificările push nu sunt pornite pe server.");
        if (request == null || request.endpoint() == null || request.keys() == null
                || request.keys().p256dh() == null || request.keys().auth() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Abonarea la notificări e incompletă.");
        }
        String endpoint = request.endpoint().trim();
        if (endpoint.length() > 1000 || !pushHost(endpoint)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Browserul nu este acceptat pentru notificări.");
        }
        try {
            WebPush.publicKey(WebPush.unb64(request.keys().p256dh()));
            if (WebPush.unb64(request.keys().auth()).length != 16) throw new IllegalArgumentException();
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cheile browserului nu sunt valide.");
        }
        // acelasi browser poate trece la alt cont (alt utilizator pe acelasi telefon): abonamentul se muta
        PushSubscription sub = repository.findByEndpoint(endpoint).orElseGet(PushSubscription::new);
        if (sub.getId() == null && repository.countByUserId(account.getId()) >= MAX_PER_ACCOUNT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cel mult " + MAX_PER_ACCOUNT + " dispozitive cu notificări pe cont.");
        }
        sub.setUserId(account.getId());
        sub.setEndpoint(endpoint);
        sub.setP256dh(request.keys().p256dh().trim());
        sub.setAuth(request.keys().auth().trim());
        sub.setTokenVersion(account.currentTokenVersion());
        sub.setUserAgent(userAgent == null ? null : userAgent.substring(0, Math.min(200, userAgent.length())));
        sub.setCreatedAt(LocalDateTime.now());
        repository.save(sub);
        return repository.countByUserId(account.getId());
    }

    @Transactional
    public void unsubscribe(AppUser account, String endpoint) {
        if (endpoint != null) repository.deleteMine(account.getId(), endpoint.trim());
    }

    @Transactional(readOnly = true)
    public long devices(AppUser account) {
        return repository.countByUserId(account.getId());
    }

    static boolean pushHost(String endpoint) {
        try {
            URI uri = URI.create(endpoint);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            return "https".equals(uri.getScheme()) && uri.getUserInfo() == null
                    && PUSH_HOSTS.stream().anyMatch(h -> host.equals(h) || host.endsWith("." + h));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    // ---------- trimitere ----------

    // Catre toate dispozitivele contului statiei (managerul)
    public void toStation(Long stationId, Message message) {
        toAccounts(List.of(stationId), message);
    }

    public void toAccounts(Collection<Long> accountIds, Message message) {
        if (!available() || accountIds.isEmpty()) return;
        List<Long> ids = List.copyOf(accountIds);
        Runnable send = () -> deliverAll(ids, message);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    dispatch(send);
                }
            });
        } else {
            dispatch(send);
        }
    }

    private void dispatch(Runnable send) {
        if (async) executor.execute(send);
        else send.run();
    }

    void deliverAll(List<Long> accountIds, Message message) {
        try {
            Map<Long, AppUser> owners = new LinkedHashMap<>();
            users.findAllById(accountIds).forEach(u -> owners.put(u.getId(), u));
            byte[] payload = json.writeValueAsBytes(message);
            for (PushSubscription sub : repository.findByUserIdIn(accountIds)) {
                AppUser owner = owners.get(sub.getUserId());
                // cont dezactivat sau parola schimbata intre timp: abonamentul nu mai e al lui
                if (owner == null || !owner.isEnabled() || sub.getTokenVersion() != owner.currentTokenVersion()) {
                    repository.deleteById(sub.getId());
                    continue;
                }
                deliver(sub, payload);
            }
        } catch (Exception e) {
            log.warn("Notificarile push nu au putut fi trimise: {}", e.getMessage());
        }
    }

    private void deliver(PushSubscription sub, byte[] payload) {
        try {
            byte[] body = WebPush.encrypt(payload, WebPush.unb64(sub.getP256dh()), WebPush.unb64(sub.getAuth()));
            Map<String, String> headers = Map.of(
                    "Authorization", WebPush.vapidAuthorization(sub.getEndpoint(), privateKey, publicKey, subject, Instant.now()),
                    "Content-Encoding", "aes128gcm",
                    "Content-Type", "application/octet-stream",
                    "TTL", "86400",
                    "Urgency", "high");
            int status = gateway.post(sub.getEndpoint(), headers, body);
            if (status == 404 || status == 410) {
                repository.deleteById(sub.getId());
            } else if (status >= 300) {
                log.warn("Serviciul de push a raspuns {} pentru abonamentul {}", status, sub.getId());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.warn("Notificarea push {} nu a plecat: {}", sub.getId(), e.getMessage());
        }
    }
}
