package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.HtmlUtils;

import java.time.Duration;
import java.time.LocalDate;
import java.util.Locale;

// Inscrierea unei statii noi din pagina publica (/inregistrare): cont de manager cu 14 zile de proba Premium
@Service
@RequiredArgsConstructor
@Slf4j
public class SignupService {

    public static final int MIN_PASSWORD_LENGTH = 8;

    public record SignupRequest(String stationName, String city, String phone, String email, String password,
                                Boolean acceptTerms, String website) {
    }

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final AccountEmailService accountEmailService;
    // Cel mult 3 conturi pe ora de pe acelasi IP
    private final SlidingWindowLimiter limiter = new SlidingWindowLimiter(3, Duration.ofHours(1));

    @Value("${leads.email:}")
    private String notifyEmail;

    // null = bot (campul capcana completat): i se raspunde ca la succes, fara cont
    @Transactional
    public AppUser signup(SignupRequest req, String ip) {
        if (req.website() != null && !req.website().isBlank()) return null;
        String station = clean(req.stationName(), 150);
        String city = clean(req.city(), 80);
        String phone = clean(req.phone(), 30);
        String email = req.email() == null ? null : req.email().trim().toLowerCase(Locale.ROOT);
        if (station == null || station.length() < 2) throw field("Scrieți numele stației.", "stationName");
        if (city == null) throw field("Scrieți orașul stației.", "city");
        if (phone == null || phone.replaceAll("\\D", "").length() < 9 || phone.replaceAll("\\D", "").length() > 15) {
            throw field("Telefonul trebuie să aibă 9–15 cifre.", "phone");
        }
        if (email == null || email.length() > 150 || !email.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) {
            throw field("Adresa de email nu pare corectă.", "email");
        }
        if (req.password() == null || req.password().length() < MIN_PASSWORD_LENGTH) {
            throw field("Parola trebuie să aibă minim " + MIN_PASSWORD_LENGTH + " caractere.", "password");
        }
        if (!Boolean.TRUE.equals(req.acceptTerms())) throw field("Acceptați termenii ca să continuați.", "acceptTerms");
        if (!limiter.tryAcquire(ip)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Prea multe înscrieri de pe această rețea. Încercați mai târziu.");
        }
        if (appUserRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Există deja un cont cu acest email. Intrați în cont sau resetați parola.");
        }
        AppUser user = AppUser.builder()
                .email(email)
                .password(passwordEncoder.encode(req.password()))
                .role(Role.MANAGER)
                .stationName(station)
                .address(city)
                .phone(phone)
                .billingCity(city)
                .emailVerified(false)
                .build();
        BillingService.startTrial(user, LocalDate.now());
        appUserRepository.save(user);
        notifyAdmin(user);
        accountEmailService.sendWelcome(user);
        return user;
    }

    private void notifyAdmin(AppUser u) {
        if (notifyEmail == null || notifyEmail.isBlank() || !emailService.isConfigured()) return;
        String html = "<h2>Stație nouă înscrisă</h2><p><b>Stație:</b> " + HtmlUtils.htmlEscape(u.getStationName())
                + "<br><b>Oraș:</b> " + HtmlUtils.htmlEscape(u.getAddress()) + "<br><b>Telefon:</b> " + HtmlUtils.htmlEscape(u.getPhone())
                + "<br><b>Email:</b> " + HtmlUtils.htmlEscape(u.getEmail()) + "<br>Proba Premium până la " + u.getPlanUntil() + "</p>";
        try {
            emailService.send(notifyEmail.trim(), "Easy ITP: stație nouă – " + u.getStationName(), html);
        } catch (DeliveryException e) {
            log.warn("Emailul pentru inscrierea {} nu a plecat: {}", u.getId(), e.getMessage());
        }
    }

    private static org.example.easyitp.config.FieldException field(String message, String field) {
        return new org.example.easyitp.config.FieldException(field, message);
    }

    private static String clean(String s, int max) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }
}
