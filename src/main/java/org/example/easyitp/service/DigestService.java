package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.dto.ReminderDTO;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Appointment;
import org.example.easyitp.entity.AppointmentSource;
import org.example.easyitp.entity.AppointmentStatus;
import org.example.easyitp.entity.DigestChannel;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.AppointmentRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

// Emailul de dimineata pentru manager: programarile de azi, programari online noi, clienti de contactat
@Service
@RequiredArgsConstructor
@Slf4j
public class DigestService {

    private static final int EXPIRING_DAYS = 7;
    private static final int MAX_ROWS = 15;
    // Mesajele WhatsApp trebuie sa ramana scurte
    private static final int WHATSAPP_ROWS = 8;
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final DateTimeFormatter DAY_TIME = DateTimeFormatter.ofPattern("dd.MM HH:mm");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private final AppUserRepository appUserRepository;
    private final AppointmentRepository appointmentRepository;
    private final ItpService itpService;
    private final EmailService emailService;
    private final WhatsAppService whatsAppService;

    @Value("${app.url:https://easyitp.vercel.app}")
    private String appUrl;

    public record Digest(String subject, String html, String text, boolean empty) {
    }

    public record Result(int sent, int skipped, int failed) {
    }

    // Trimite emailul tuturor managerilor activi care nu l-au primit azi; emailurile fara continut nu se trimit
    public Result sendDailyDigests(LocalDate today) {
        int sent = 0, skipped = 0, failed = 0;
        for (AppUser user : appUserRepository.findByRoleOrderByIdAsc(Role.MANAGER)) {
            if (!user.isEnabled() || Boolean.FALSE.equals(user.getDigestEnabled()) || today.equals(user.getLastDigestDate())) {
                skipped++;
                continue;
            }
            Digest digest = build(user, today);
            if (digest.empty()) {
                skipped++;
                continue;
            }
            try {
                deliver(user, digest, false);
                user.setLastDigestDate(today);
                appUserRepository.save(user);
                sent++;
            } catch (DeliveryException e) {
                log.warn("Rezumatul zilnic pentru {} nu a fost trimis: {}", user.getEmail(), e.getMessage());
                failed++;
            }
        }
        log.info("Rezumat zilnic {}: {} trimise, {} sarite, {} esuate", today, sent, skipped, failed);
        return new Result(sent, skipped, failed);
    }

    // Mesajul de test din "Contul meu": se trimite chiar daca nu e nimic de raportat
    public void sendTest(AppUser user) {
        deliver(user, build(user, LocalDate.now()), true);
    }

    // Pe canalul ales de manager: email (implicit) sau WhatsApp prin CallMeBot
    private void deliver(AppUser user, Digest digest, boolean test) {
        String prefix = test ? "[Test] " : "";
        if (user.getDigestChannel() == DigestChannel.WHATSAPP) {
            whatsAppService.send(user.getWhatsappPhone(), user.getCallmebotApiKey(), prefix + digest.text());
        } else {
            emailService.send(user.getEmail(), prefix + digest.subject(), digest.html());
        }
    }

    public Digest build(AppUser user, LocalDate today) {
        List<Appointment> todayAppointments = appointmentRepository
                .findByUserIdAndAppointmentDateBetweenOrderByAppointmentDateAsc(
                        user.getId(), today.atStartOfDay(), today.plusDays(1).atStartOfDay())
                .stream().filter(a -> a.getStatus() != AppointmentStatus.CANCELLED).toList();

        LocalDateTime since = LocalDateTime.now().minusHours(24);
        List<Appointment> newOnline = appointmentRepository
                .findByUserIdAndSourceAndCreatedAtAfterOrderByAppointmentDateAsc(user.getId(), AppointmentSource.ONLINE, since)
                .stream()
                .filter(a -> a.getStatus() != AppointmentStatus.CANCELLED && !a.getAppointmentDate().toLocalDate().isBefore(today))
                .toList();

        List<ReminderDTO> toContact = itpService.getReminders(user.getId()).stream()
                .filter(r -> r.getReminderStatus() == null)
                .toList();
        List<ReminderDTO> expiringSoon = toContact.stream()
                .filter(r -> r.getZileRamase() >= 0 && r.getZileRamase() <= EXPIRING_DAYS)
                .sorted((a, b) -> Long.compare(a.getZileRamase(), b.getZileRamase()))
                .toList();
        List<ReminderDTO> expired = toContact.stream()
                .filter(r -> r.getZileRamase() < 0)
                .sorted((a, b) -> Long.compare(b.getZileRamase(), a.getZileRamase()))
                .toList();

        boolean empty = todayAppointments.isEmpty() && newOnline.isEmpty() && expiringSoon.isEmpty() && expired.isEmpty();
        String subject = subject(today, todayAppointments.size(), newOnline.size(), expiringSoon.size() + expired.size());

        List<Section> sections = new ArrayList<>();
        if (!todayAppointments.isEmpty()) {
            sections.add(new Section("Programări azi (" + todayAppointments.size() + ")",
                    todayAppointments.stream().map(a -> List.of(
                            a.getAppointmentDate().format(TIME),
                            a.getClientName() + (a.getSource() == AppointmentSource.ONLINE ? " (online)" : ""),
                            Objects.toString(a.getLicensePlate(), ""),
                            Objects.toString(a.getPhone(), ""))).toList(),
                    "/calendar", "Deschide calendarul"));
        }
        if (!newOnline.isEmpty()) {
            sections.add(new Section("Programări online noi (" + newOnline.size() + ")",
                    newOnline.stream().map(a -> List.of(
                            a.getAppointmentDate().format(DAY_TIME),
                            a.getClientName(),
                            Objects.toString(a.getLicensePlate(), ""),
                            Objects.toString(a.getPhone(), ""))).toList(),
                    null, null));
        }
        if (!expiringSoon.isEmpty()) {
            sections.add(new Section("ITP expiră în următoarele " + EXPIRING_DAYS + " zile (" + expiringSoon.size() + ")",
                    expiringSoon.stream().map(r -> List.of(
                            r.getZileRamase() == 0 ? "azi" : "în " + r.getZileRamase() + (r.getZileRamase() == 1 ? " zi" : " zile"),
                            r.getNumeSofer(),
                            r.getNumarInmatriculare(),
                            Objects.toString(r.getContact(), ""))).toList(),
                    expired.isEmpty() ? "/reminders" : null, "Contactează clienții"));
        }
        if (!expired.isEmpty()) {
            sections.add(new Section("ITP expirat, încă necontactați (" + expired.size() + ")",
                    expired.stream().map(r -> List.of(
                            "de " + Math.abs(r.getZileRamase()) + " zile",
                            r.getNumeSofer(),
                            r.getNumarInmatriculare(),
                            Objects.toString(r.getContact(), ""))).toList(),
                    "/reminders", "Contactează clienții"));
        }

        String station = Objects.toString(user.getStationName(), "Stația ta");
        return new Digest(subject, renderHtml(station, today, sections, empty), renderText(station, today, sections, empty), empty);
    }

    private record Section(String title, List<List<String>> rows, String linkPath, String linkLabel) {
    }

    private String renderHtml(String station, LocalDate today, List<Section> sections, boolean empty) {
        StringBuilder html = new StringBuilder();
        html.append("<div style=\"font-family:Arial,sans-serif;max-width:600px;color:#1e293b\">")
                .append("<h2 style=\"margin:0 0 4px\">Bună dimineața!</h2>")
                .append("<p style=\"margin:0 0 16px;color:#64748b\">")
                .append(esc(station)).append(" · ").append(today.format(DAY))
                .append("</p>");
        if (empty) {
            html.append("<p>Nimic de raportat azi: nicio programare și niciun client de contactat.</p>");
        }
        for (Section section : sections) {
            section(html, section.title());
            table(html, section.rows().stream().limit(MAX_ROWS).toList());
            more(html, section.rows().size());
            if (section.linkPath() != null) button(html, section.linkPath(), section.linkLabel());
        }
        html.append("<p style=\"margin-top:24px;font-size:12px;color:#94a3b8\">")
                .append("Primești acest email pentru că ești manager în EasyITP. Îl poți opri din „Contul meu”.</p></div>");
        return html.toString();
    }

    // Varianta pentru WhatsApp: text simplu, *bold* in stilul WhatsApp, liste scurte
    private String renderText(String station, LocalDate today, List<Section> sections, boolean empty) {
        StringBuilder text = new StringBuilder();
        text.append("*EasyITP · ").append(station).append("*\n").append(today.format(DAY)).append("\n");
        if (empty) {
            text.append("\nNimic de raportat azi: nicio programare și niciun client de contactat.\n");
        }
        for (Section section : sections) {
            text.append("\n*").append(section.title()).append("*\n");
            section.rows().stream().limit(WHATSAPP_ROWS).forEach(row -> text.append("• ")
                    .append(String.join(" · ", row.stream().filter(v -> v != null && !v.isBlank()).toList()))
                    .append("\n"));
            if (section.rows().size() > WHATSAPP_ROWS) {
                text.append("…și încă ").append(section.rows().size() - WHATSAPP_ROWS).append("\n");
            }
        }
        if (!sections.isEmpty()) {
            boolean toContact = sections.stream().anyMatch(sec -> "/reminders".equals(sec.linkPath()));
            text.append("\n").append(appUrl).append(toContact ? "/reminders" : "/calendar");
        }
        return text.toString().trim();
    }

    static String subject(LocalDate today, int appointments, int newOnline, int toContact) {
        StringBuilder s = new StringBuilder("EasyITP ").append(today.format(DAY)).append(": ");
        s.append(appointments).append(appointments == 1 ? " programare azi" : " programări azi");
        if (newOnline > 0) s.append(", ").append(newOnline).append(newOnline == 1 ? " programare online nouă" : " programări online noi");
        s.append(", ").append(toContact).append(" de contactat");
        return s.toString();
    }

    private static void section(StringBuilder html, String title) {
        html.append("<h3 style=\"margin:24px 0 8px;font-size:15px\">").append(esc(title)).append("</h3>");
    }

    private static void table(StringBuilder html, List<List<String>> rows) {
        html.append("<table style=\"border-collapse:collapse;width:100%;font-size:14px\">");
        for (List<String> row : rows) {
            html.append("<tr>");
            for (int i = 0; i < row.size(); i++) {
                html.append("<td style=\"padding:6px 8px;border-bottom:1px solid #e2e8f0;")
                        .append(i == 0 ? "white-space:nowrap;color:#64748b" : "")
                        .append("\">").append(esc(row.get(i))).append("</td>");
            }
            html.append("</tr>");
        }
        html.append("</table>");
    }

    private static void more(StringBuilder html, int total) {
        if (total > MAX_ROWS) {
            html.append("<p style=\"font-size:13px;color:#64748b;margin:6px 0 0\">și încă ")
                    .append(total - MAX_ROWS).append(" în aplicație</p>");
        }
    }

    private void button(StringBuilder html, String path, String label) {
        html.append("<p style=\"margin:12px 0 0\"><a href=\"").append(esc(appUrl + path))
                .append("\" style=\"display:inline-block;background:#2563eb;color:#fff;text-decoration:none;")
                .append("padding:8px 14px;border-radius:8px;font-size:14px\">").append(esc(label)).append("</a></p>");
    }

    // Datele vin de la clienti (inclusiv de pe pagina publica), deci se escapeaza
    private static String esc(String s) {
        return HtmlUtils.htmlEscape(Objects.toString(s, ""), "UTF-8");
    }
}
