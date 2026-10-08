package org.example.easyitp.service;

import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Appointment;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

// Programarea in calendarul clientului: link "Adauga in Google Calendar" si fisierul .ics (telefon, Outlook, Apple)
public final class CalendarLinks {

    private static final ZoneId ZONE = ZoneId.of("Europe/Bucharest");
    private static final DateTimeFormatter LOCAL = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss");
    private static final DateTimeFormatter UTC = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");

    private CalendarLinks() {
    }

    static String title(AppUser station) {
        return "ITP la " + (station.getStationName() != null ? station.getStationName() : "stația ITP");
    }

    static String details(Appointment appt, AppUser station, String manageLink) {
        StringBuilder b = new StringBuilder();
        if (appt.getLicensePlate() != null) b.append("Mașina: ").append(appt.getLicensePlate()).append("\n");
        if (station.getPhone() != null) b.append("Telefon stație: ").append(station.getPhone()).append("\n");
        b.append("Anulare sau altă oră: ").append(manageLink);
        return b.toString();
    }

    public static String google(Appointment appt, AppUser station, String manageLink) {
        LocalDateTime start = appt.getAppointmentDate();
        LocalDateTime end = start.plusMinutes(InspectionDurations.minutesOf(appt));
        return "https://calendar.google.com/calendar/render?action=TEMPLATE"
                + "&text=" + enc(title(station))
                + "&dates=" + start.format(LOCAL) + "/" + end.format(LOCAL)
                + "&ctz=" + enc(ZONE.getId())
                + "&details=" + enc(details(appt, station, manageLink))
                + (station.getAddress() != null ? "&location=" + enc(station.getAddress()) : "");
    }

    // Un eveniment iCalendar (RFC 5545), cu orele in UTC si un memento cu o ora inainte
    public static String ics(Appointment appt, AppUser station, String manageLink) {
        LocalDateTime start = appt.getAppointmentDate();
        LocalDateTime end = start.plusMinutes(InspectionDurations.minutesOf(appt));
        String nl = "\r\n";
        StringBuilder b = new StringBuilder()
                .append("BEGIN:VCALENDAR").append(nl)
                .append("VERSION:2.0").append(nl)
                .append("PRODID:-//Easy ITP//Programari//RO").append(nl)
                .append("METHOD:PUBLISH").append(nl)
                .append("BEGIN:VEVENT").append(nl)
                .append("UID:").append(appt.getManageToken()).append("@easyitp").append(nl)
                .append("DTSTAMP:").append(utc(LocalDateTime.now())).append(nl)
                .append("DTSTART:").append(utc(start)).append(nl)
                .append("DTEND:").append(utc(end)).append(nl)
                .append(fold("SUMMARY:" + escape(title(station)))).append(nl)
                .append(fold("DESCRIPTION:" + escape(details(appt, station, manageLink)))).append(nl);
        if (station.getAddress() != null) b.append(fold("LOCATION:" + escape(station.getAddress()))).append(nl);
        b.append(fold("URL:" + manageLink)).append(nl)
                .append("BEGIN:VALARM").append(nl)
                .append("TRIGGER:-PT1H").append(nl)
                .append("ACTION:DISPLAY").append(nl)
                .append(fold("DESCRIPTION:" + escape(title(station)))).append(nl)
                .append("END:VALARM").append(nl)
                .append("END:VEVENT").append(nl)
                .append("END:VCALENDAR").append(nl);
        return b.toString();
    }

    private static String utc(LocalDateTime local) {
        return local.atZone(ZONE).withZoneSameInstant(ZoneOffset.UTC).format(UTC);
    }

    // Textul din iCalendar: \ ; , si randurile noi se scriu cu \
    static String escape(String s) {
        return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r", "").replace("\n", "\\n");
    }

    // Randurile mai lungi de 75 de octeti continua pe randul urmator, cu un spatiu in fata
    static String fold(String line) {
        StringBuilder out = new StringBuilder();
        int bytes = 0;
        for (int i = 0; i < line.length(); ) {
            int cp = line.codePointAt(i);
            String ch = new String(Character.toChars(cp));
            int len = ch.getBytes(StandardCharsets.UTF_8).length;
            if (bytes + len > 75) {
                out.append("\r\n ");
                bytes = 1;
            }
            out.append(ch);
            bytes += len;
            i += Character.charCount(cp);
        }
        return out.toString();
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
