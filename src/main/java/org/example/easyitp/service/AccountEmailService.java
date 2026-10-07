package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.config.FieldException;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.AuthToken;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.AuthTokenRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;

// Emailurile despre cont: bun venit cu confirmarea adresei, retrimiterea confirmarii si "Am uitat parola".
// Linkul contine un token aleator; in baza de date ramane doar hash-ul lui, valabil o perioada si folosibil o data.
@Service
@RequiredArgsConstructor
@Slf4j
public class AccountEmailService {

    public static final Duration RESET_TTL = Duration.ofHours(1);
    public static final Duration VERIFY_TTL = Duration.ofDays(7);
    public static final int MIN_PASSWORD_LENGTH = SignupService.MIN_PASSWORD_LENGTH;

    private static final SecureRandom RANDOM = new SecureRandom();

    private final AppUserRepository appUserRepository;
    private final AuthTokenRepository authTokenRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    // "Am uitat parola": cel mult 5 cereri pe ora de pe un IP si 3 pe ora pentru acelasi email
    private final SlidingWindowLimiter resetByIp = new SlidingWindowLimiter(5, Duration.ofHours(1));
    private final SlidingWindowLimiter resetByEmail = new SlidingWindowLimiter(3, Duration.ofHours(1));
    private final SlidingWindowLimiter verifyResends = new SlidingWindowLimiter(3, Duration.ofHours(1));

    @Value("${app.url:https://easyitp.vercel.app}")
    private String appUrl;

    // Dupa inscriere: un singur email, de bun venit, cu linkul de confirmare. O eroare nu strica inscrierea.
    public void sendWelcome(AppUser user) {
        if (!emailService.isConfigured()) return;
        String link = link("/confirmare-email", newToken(user, AuthToken.Purpose.VERIFY_EMAIL, VERIFY_TTL));
        String html = AccountMail.html("Bine ați venit în Easy ITP!", new String[]{
                "Contul stației " + (user.getStationName() == null ? "" : user.getStationName()) + " a fost creat. Aveți "
                        + Plans.TRIAL_DAYS + " zile de probă cu pachetul Premium, cu toate funcțiile.",
                "Confirmați adresa de email, ca să puteți primi rezumatul de dimineață, resetarea parolei și anunțurile despre cont.",
        }, "Confirmă adresa de email", link,
                "Primii pași îi găsiți în aplicație, la „Ghid de utilizare”. Dacă nu ați creat dumneavoastră contul, ignorați acest email.");
        try {
            emailService.send(user.getEmail(), "Bine ați venit în Easy ITP – confirmați adresa de email", html);
        } catch (DeliveryException e) {
            log.warn("Emailul de bun venit pentru {} nu a plecat: {}", user.getId(), e.getMessage());
        }
    }

    public void resendVerification(AppUser user) {
        if (!Boolean.FALSE.equals(user.getEmailVerified())) throw badRequest("Adresa de email este deja confirmată.");
        if (!emailService.isConfigured()) throw unavailable();
        if (!verifyResends.tryAcquire(String.valueOf(user.getId()))) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Am trimis deja câteva emailuri. Încercați peste o oră.");
        }
        String link = link("/confirmare-email", newToken(user, AuthToken.Purpose.VERIFY_EMAIL, VERIFY_TTL));
        String html = AccountMail.html("Confirmați adresa de email", new String[]{
                "Apăsați butonul de mai jos ca să confirmați adresa de email a contului Easy ITP.",
        }, "Confirmă adresa de email", link, "Linkul este valabil 7 zile.");
        try {
            emailService.send(user.getEmail(), "Easy ITP – confirmați adresa de email", html);
        } catch (DeliveryException e) {
            throw badRequest(e.getMessage());
        }
    }

    @Transactional
    public void verifyEmail(String token) {
        AuthToken t = use(token, AuthToken.Purpose.VERIFY_EMAIL, "Linkul de confirmare nu mai este valabil. Cereți altul din aplicație.");
        AppUser user = appUserRepository.findById(t.getUserId()).orElseThrow(() -> badRequest("Contul nu mai există."));
        user.setEmailVerified(true);
        appUserRepository.save(user);
    }

    // Raspunsul e acelasi, fie ca emailul are cont, fie ca nu (nu aratam cine e client)
    public void forgotPassword(String rawEmail, String ip) {
        String email = rawEmail == null ? "" : rawEmail.trim().toLowerCase(Locale.ROOT);
        if (email.isEmpty() || email.length() > 150) throw new FieldException("email", "Scrieți adresa de email a contului.");
        if (!emailService.isConfigured()) throw unavailable();
        if (!resetByIp.tryAcquire(ip) || !resetByEmail.tryAcquire(email)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Prea multe cereri. Încercați din nou peste o oră.");
        }
        AppUser user = appUserRepository.findByEmailIgnoreCase(email).filter(AppUser::isEnabled).orElse(null);
        // Inspectorii n-au email real (prenume.nume@statie): parola le-o reseteaza managerul
        if (user == null || user.getRole() == org.example.easyitp.entity.Role.INSPECTOR) return;
        String link = link("/resetare-parola", newToken(user, AuthToken.Purpose.RESET_PASSWORD, RESET_TTL));
        String html = AccountMail.html("Resetarea parolei", new String[]{
                "Ați cerut o parolă nouă pentru contul Easy ITP " + user.getEmail() + ".",
                "Apăsați butonul de mai jos și alegeți parola nouă. Linkul este valabil o oră și merge o singură dată.",
        }, "Alege parola nouă", link, "Dacă nu ați cerut dumneavoastră resetarea, ignorați acest email: parola rămâne aceeași.");
        try {
            emailService.send(user.getEmail(), "Easy ITP – resetarea parolei", html);
        } catch (DeliveryException e) {
            log.warn("Emailul de resetare pentru {} nu a plecat: {}", user.getId(), e.getMessage());
        }
    }

    // Parola noua: celelalte sesiuni se inchid; emailul e confirmat (linkul a ajuns in casuta)
    @Transactional
    public void resetPassword(String token, String password) {
        if (password == null || password.length() < MIN_PASSWORD_LENGTH) {
            throw new FieldException("password", "Parola trebuie să aibă minim " + MIN_PASSWORD_LENGTH + " caractere.");
        }
        AuthToken t = use(token, AuthToken.Purpose.RESET_PASSWORD, "Linkul de resetare nu mai este valabil. Cereți altul.");
        AppUser user = appUserRepository.findById(t.getUserId()).filter(AppUser::isEnabled)
                .orElseThrow(() -> badRequest("Linkul de resetare nu mai este valabil. Cereți altul."));
        user.setPassword(passwordEncoder.encode(password));
        user.revokeTokens();
        if (Boolean.FALSE.equals(user.getEmailVerified())) user.setEmailVerified(true);
        appUserRepository.save(user);
        authTokenRepository.invalidate(user.getId(), AuthToken.Purpose.RESET_PASSWORD, LocalDateTime.now());
    }

    private AuthToken use(String token, AuthToken.Purpose purpose, String invalidMessage) {
        if (token == null || token.isBlank() || token.length() > 100) throw badRequest(invalidMessage);
        AuthToken t = authTokenRepository.lockByHash(hash(token.trim())).orElseThrow(() -> badRequest(invalidMessage));
        LocalDateTime now = LocalDateTime.now();
        if (t.getPurpose() != purpose || t.getUsedAt() != null || t.getExpiresAt().isBefore(now)) throw badRequest(invalidMessage);
        t.setUsedAt(now);
        authTokenRepository.save(t);
        return t;
    }

    private String newToken(AppUser user, AuthToken.Purpose purpose, Duration ttl) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        LocalDateTime now = LocalDateTime.now();
        authTokenRepository.invalidate(user.getId(), purpose, now);
        authTokenRepository.save(AuthToken.builder().userId(user.getId()).purpose(purpose).tokenHash(hash(token))
                .expiresAt(now.plus(ttl)).createdAt(now).build());
        return token;
    }

    // Curatarea zilnica: tokenurile expirate de peste o zi
    public void purgeExpired() {
        authTokenRepository.purgeExpired(LocalDateTime.now().minusDays(1));
    }

    static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private String link(String path, String token) {
        return AccountMail.stripSlash(appUrl) + path + "?token=" + token;
    }

    private static ResponseStatusException unavailable() {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Trimiterea de emailuri nu este disponibilă momentan. Scrieți-ne și vă ajutăm.");
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
