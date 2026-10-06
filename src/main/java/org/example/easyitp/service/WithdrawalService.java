package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.config.FieldException;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Withdrawal;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.WithdrawalRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.HtmlUtils;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

// Functia de retragere din contract (OUG 34/2014 art. 11^1): formular public, confirmare de primire pe email
// (suport durabil, cu data si ora) si anunt catre admin. Rambursarea se face apoi conform termenilor.
@Service
@RequiredArgsConstructor
@Slf4j
public class WithdrawalService {

    private static final DateTimeFormatter RO = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");

    public record WithdrawalRequest(String name, String email, String contract, String message, String website) {
    }

    private final WithdrawalRepository withdrawalRepository;
    private final AppUserRepository appUserRepository;
    private final EmailService emailService;
    // Cel mult 5 cereri pe ora de pe acelasi IP
    private final SlidingWindowLimiter limiter = new SlidingWindowLimiter(5, Duration.ofHours(1));

    @Value("${leads.email:}")
    private String notifyEmail;

    // null = bot (campul capcana): raspuns ca la succes, fara salvare
    public Withdrawal submit(WithdrawalRequest req, String ip) {
        if (req.website() != null && !req.website().isBlank()) return null;
        String name = clean(req.name(), 150);
        String email = req.email() == null ? null : req.email().trim().toLowerCase(Locale.ROOT);
        String contract = clean(req.contract(), 300);
        if (name == null || name.length() < 2) throw new FieldException("name", "Scrieți numele dumneavoastră sau al firmei.");
        if (email == null || email.length() > 150 || !email.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) {
            throw new FieldException("email", "Adresa de email nu pare corectă.");
        }
        if (contract == null) throw new FieldException("contract", "Spuneți-ne despre ce contract este vorba (ex. emailul contului).");
        if (!limiter.tryAcquire(ip)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Ați trimis deja câteva cereri. Încercați mai târziu.");
        }
        Long userId = appUserRepository.findByEmailIgnoreCase(email).map(AppUser::getId).orElse(null);
        Withdrawal w = withdrawalRepository.save(Withdrawal.builder().name(name).email(email).contract(contract)
                .message(clean(req.message(), 1000)).userId(userId).createdAt(LocalDateTime.now()).handled(false).build());
        sendReceipt(w);
        notifyAdmin(w);
        log.info("Cerere de retragere {} primita", w.getId());
        return w;
    }

    // Confirmarea de primire pentru client, cu continutul cererii si momentul primirii
    private void sendReceipt(Withdrawal w) {
        if (!emailService.isConfigured()) return;
        String html = AccountMail.html("Am primit cererea de retragere din contract", new String[]{
                "Am primit pe " + w.getCreatedAt().format(RO) + " cererea dumneavoastră de retragere din contractul Easy ITP.",
                "Nume: " + w.getName() + " · Email: " + w.getEmail() + " · Contract: " + w.getContract(),
                "Vă răspundem în cel mult 14 zile. Dacă ați plătit un abonament ca persoană fizică, vă returnăm suma "
                        + "corespunzătoare zilelor nefolosite, pe același card sau în contul din care ați plătit.",
        }, null, null, "Păstrați acest email: este confirmarea primirii cererii (numărul " + w.getId() + ").");
        try {
            emailService.send(w.getEmail(), "Easy ITP – confirmarea primirii cererii de retragere", html);
        } catch (DeliveryException e) {
            log.warn("Confirmarea retragerii {} nu a plecat: {}", w.getId(), e.getMessage());
        }
    }

    private void notifyAdmin(Withdrawal w) {
        if (notifyEmail == null || notifyEmail.isBlank() || !emailService.isConfigured()) return;
        String html = "<h2>Cerere de retragere din contract</h2><p><b>Nume:</b> " + HtmlUtils.htmlEscape(w.getName())
                + "<br><b>Email:</b> " + HtmlUtils.htmlEscape(w.getEmail()) + "<br><b>Contract:</b> " + HtmlUtils.htmlEscape(w.getContract())
                + (w.getMessage() == null ? "" : "<br><b>Mesaj:</b> " + HtmlUtils.htmlEscape(w.getMessage()))
                + "<br><b>Cont găsit:</b> " + (w.getUserId() == null ? "nu" : "da (#" + w.getUserId() + ")") + "</p>";
        try {
            emailService.send(notifyEmail.trim(), "Easy ITP: cerere de retragere de la " + w.getName(), html);
        } catch (DeliveryException e) {
            log.warn("Anuntul pentru retragerea {} nu a plecat: {}", w.getId(), e.getMessage());
        }
    }

    private static String clean(String s, int max) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }
}
