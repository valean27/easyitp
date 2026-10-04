package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.entity.Lead;
import org.example.easyitp.repository.LeadRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.HtmlUtils;

import java.time.Duration;
import java.time.LocalDateTime;

// Cererile de demonstratie din pagina de prezentare: se salveaza (adminul le vede in aplicatie)
// si, daca e setat LEADS_EMAIL, pleaca si un email de anunt
@Service
@RequiredArgsConstructor
@Slf4j
public class LeadService {

    public record LeadRequest(String name, String station, String city, String phone, String email, String message,
                              String website) {
    }

    private final LeadRepository leadRepository;
    private final EmailService emailService;
    // Cel mult 3 cereri pe ora de pe acelasi IP
    private final SlidingWindowLimiter limiter = new SlidingWindowLimiter(3, Duration.ofHours(1));

    @Value("${leads.email:}")
    private String notifyEmail;

    // Intoarce false pentru boti (campul capcana completat): li se raspunde ca la succes, fara salvare
    public boolean submit(LeadRequest req, String ip) {
        if (req.website() != null && !req.website().isBlank()) return false;
        String name = clean(req.name(), 100);
        String phone = clean(req.phone(), 30);
        String email = clean(req.email(), 150);
        if (name == null || name.length() < 2) throw badRequest("Spuneți-ne cum vă numiți.");
        if (phone == null && email == null) throw badRequest("Lăsați un telefon sau un email ca să vă putem contacta.");
        if (phone != null && phone.replaceAll("\\D", "").length() < 9) throw badRequest("Numărul de telefon nu pare complet.");
        if (email != null && !email.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) throw badRequest("Adresa de email nu pare corectă.");
        if (!limiter.tryAcquire(ip)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Ați trimis deja câteva cereri. Încercați mai târziu.");
        }
        Lead lead = leadRepository.save(Lead.builder()
                .name(name).station(clean(req.station(), 150)).city(clean(req.city(), 80))
                .phone(phone).email(email).message(clean(req.message(), 1000))
                .createdAt(LocalDateTime.now()).handled(false).build());
        notifyAdmin(lead);
        return true;
    }

    private void notifyAdmin(Lead lead) {
        if (notifyEmail == null || notifyEmail.isBlank() || !emailService.isConfigured()) return;
        String html = "<h2>Cerere de demonstrație</h2><p>"
                + line("Nume", lead.getName()) + line("Stație", lead.getStation()) + line("Oraș", lead.getCity())
                + line("Telefon", lead.getPhone()) + line("Email", lead.getEmail()) + line("Mesaj", lead.getMessage())
                + "</p>";
        try {
            emailService.send(notifyEmail.trim(), "Easy ITP: cerere de demonstrație de la " + lead.getName(), html);
        } catch (DeliveryException e) {
            // cererea e salvata oricum; adminul o vede in aplicatie
            log.warn("Emailul pentru cererea de demonstratie {} nu a plecat: {}", lead.getId(), e.getMessage());
        }
    }

    private static String line(String label, String value) {
        return value == null ? "" : "<b>" + label + ":</b> " + HtmlUtils.htmlEscape(value).replace("\n", "<br>") + "<br>";
    }

    private static String clean(String s, int max) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
