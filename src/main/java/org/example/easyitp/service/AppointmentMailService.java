package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Appointment;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

// Emailurile despre programari: clientului (daca si-a lasat emailul) la programare, mutare, anulare, cu link de
// Google Calendar si fisier .ics; managerului statiei la fiecare programare online (daca nu a oprit asta).
// O eroare de trimitere nu strica programarea.
@Slf4j
@Service
@RequiredArgsConstructor
public class AppointmentMailService {

    private static final DateTimeFormatter WHEN = DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy, 'ora' HH:mm", Locale.forLanguageTag("ro"));

    private final EmailService emailService;
    private final AppointmentSmsService appointmentSmsService;

    @Value("${app.url:https://easyitp.vercel.app}")
    private String appUrl;

    @Value("${api.url:https://easyitp.onrender.com}")
    private String apiUrl;

    public enum Event {
        BOOKED, MOVED, CANCELLED
    }

    public static String when(LocalDateTime d) {
        String s = d.format(WHEN);
        return s.substring(0, 1).toUpperCase(Locale.ROOT) + s.substring(1);
    }

    public String icsLink(Appointment appt) {
        return AccountMail.stripSlash(apiUrl) + "/api/public/appointments/" + appt.getManageToken() + "/calendar.ics";
    }

    public void toClient(Appointment appt, Event event) {
        if (appt.getEmail() == null || !emailService.isConfigured()) return;
        AppUser station = appt.getUser();
        String stationName = station.getStationName() != null ? station.getStationName() : "stația ITP";
        String manage = appointmentSmsService.manageLink(appt);
        String subject = switch (event) {
            case BOOKED -> "Programare ITP confirmată – " + stationName;
            case MOVED -> "Programare ITP mutată – " + stationName;
            case CANCELLED -> "Programare ITP anulată – " + stationName;
        };
        String intro = switch (event) {
            case BOOKED -> "Programarea dumneavoastră la ITP este confirmată.";
            case MOVED -> "Programarea dumneavoastră la ITP a fost mutată.";
            case CANCELLED -> "Programarea dumneavoastră la ITP a fost anulată. Vă puteți programa oricând din nou.";
        };
        StringBuilder b = start(stationName);
        b.append(p(intro));
        b.append(details(appt, station, event == Event.CANCELLED));
        if (event != Event.CANCELLED) {
            b.append("<p style=\"margin:20px 0 8px\">")
                    .append(button("Adaugă în Google Calendar", CalendarLinks.google(appt, station, manage), "#2563eb"))
                    .append(" ")
                    .append(button("Calendar telefon (.ics)", icsLink(appt), "#475569"))
                    .append("</p>")
                    .append(small("Nu mai puteți ajunge? Anulați sau alegeți altă oră din linkul: " + manage));
        } else if (station.getBookingSlug() != null) {
            b.append("<p style=\"margin:20px 0 8px\">")
                    .append(button("Fă o programare nouă", AccountMail.stripSlash(appUrl) + "/programare/" + station.getBookingSlug(), "#2563eb"))
                    .append("</p>");
        }
        send(appt.getEmail(), subject, end(b));
    }

    // Managerul statiei: programare noua, mutata sau anulata de client
    public void toStation(Appointment appt, Event event) {
        AppUser station = appt.getUser();
        if (Boolean.FALSE.equals(station.getBookingEmailNotify()) || Boolean.FALSE.equals(station.getEmailVerified())
                || station.getEmail() == null || !emailService.isConfigured()) return;
        String subject = switch (event) {
            case BOOKED -> "Programare nouă online: " + appt.getClientName() + ", " + when(appt.getAppointmentDate());
            case MOVED -> "Programare mutată de client: " + appt.getClientName() + ", " + when(appt.getAppointmentDate());
            case CANCELLED -> "Programare anulată de client: " + appt.getClientName() + ", " + when(appt.getAppointmentDate());
        };
        StringBuilder b = start(station.getStationName() != null ? station.getStationName() : "Easy ITP");
        b.append(p(switch (event) {
            case BOOKED -> "Un client s-a programat pe pagina online a stației.";
            case MOVED -> "Clientul și-a mutat programarea din linkul primit.";
            case CANCELLED -> "Clientul și-a anulat programarea din linkul primit; intervalul s-a eliberat.";
        }));
        b.append(details(appt, station, event == Event.CANCELLED));
        if (appt.getPhone() != null) b.append(p("Telefon: " + appt.getPhone()));
        if (appt.getEmail() != null) b.append(p("Email: " + appt.getEmail()));
        b.append("<p style=\"margin:20px 0 8px\">")
                .append(button("Deschide calendarul", AccountMail.stripSlash(appUrl) + "/calendar", "#2563eb"))
                .append("</p>")
                .append(small("Nu mai vreți emailuri la fiecare programare? Le opriți din Contul meu → Programare online."));
        send(station.getEmail(), subject, end(b));
    }

    private void send(String to, String subject, String html) {
        try {
            emailService.send(to, subject, html);
        } catch (DeliveryException e) {
            log.warn("Emailul despre programare nu a plecat: {}", e.getMessage());
        }
    }

    private static String details(Appointment appt, AppUser station, boolean cancelled) {
        StringBuilder b = new StringBuilder("<table style=\"font-size:15px;margin:8px 0 4px;border-collapse:collapse\">");
        row(b, cancelled ? "Era programat" : "Când", when(appt.getAppointmentDate()));
        row(b, "Unde", station.getStationName() + (station.getAddress() != null ? ", " + station.getAddress() : ""));
        if (appt.getVehicleCategory() != null) row(b, "Vehicul", appt.getVehicleCategory().label());
        if (appt.getLicensePlate() != null) row(b, "Mașina", appt.getLicensePlate());
        if (station.getPhone() != null) row(b, "Telefon stație", station.getPhone());
        return b.append("</table>").toString();
    }

    private static void row(StringBuilder b, String label, String value) {
        b.append("<tr><td style=\"padding:3px 12px 3px 0;color:#64748b;vertical-align:top\">").append(esc(label))
                .append("</td><td style=\"padding:3px 0;font-weight:bold\">").append(esc(value)).append("</td></tr>");
    }

    private static StringBuilder start(String heading) {
        return new StringBuilder("<div style=\"font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1e293b\">")
                .append("<p style=\"font-size:18px;font-weight:bold;color:#2563eb;margin:0 0 16px\">").append(esc(heading)).append("</p>");
    }

    private static String end(StringBuilder b) {
        return b.append("<p style=\"font-size:12px;color:#94a3b8;margin:24px 0 0\">Trimis prin Easy ITP</p></div>").toString();
    }

    private static String p(String text) {
        return "<p style=\"font-size:15px;line-height:1.5;margin:0 0 12px\">" + esc(text) + "</p>";
    }

    private static String small(String text) {
        return "<p style=\"font-size:12px;color:#64748b;margin:8px 0 0\">" + esc(text) + "</p>";
    }

    private static String button(String text, String url, String color) {
        return "<a href=\"" + esc(url) + "\" style=\"background:" + color + ";color:#ffffff;text-decoration:none;padding:11px 16px;"
                + "border-radius:8px;font-weight:bold;display:inline-block;margin:0 6px 6px 0\">" + esc(text) + "</a>";
    }

    private static String esc(String s) {
        return HtmlUtils.htmlEscape(s == null ? "" : s);
    }
}
