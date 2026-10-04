package org.example.easyitp.service;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

// Textul SMS-ului de reamintire: aceleasi placeholdere ca mesajele manuale (utils/reminderMessage.ts), dar fara
// diacritice: cu "ă, ș, ț" un SMS are 70 de caractere in loc de 160 si costa de doua ori mai mult
public final class SmsText {

    public static final String DEFAULT_TEMPLATE =
            "{statie}: ITP-ul pentru {numar} {expira} {data}. Programari la {telefon}. Online: {link}";
    private static final DateTimeFormatter RO_DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    private SmsText() {
    }

    public record Data(String name, String plate, String car, LocalDate expiry, boolean expired, String station,
                       String address, String phone, String bookingLink, String stopLink) {
    }

    // Propozitiile cu un placeholder gol (ex. statie fara programare online) sunt scoase; link-ul STOP se adauga
    // pe rand nou daca sablonul nu il are
    public static String render(String template, Data d) {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("{nume}", trim(d.name()));
        values.put("{numar}", trim(d.plate()));
        values.put("{masina}", trim(d.car()));
        values.put("{expira}", d.expired() ? "a expirat pe" : "expira pe");
        values.put("{data}", d.expiry() == null ? "" : d.expiry().format(RO_DATE));
        values.put("{statie}", trim(d.station()));
        values.put("{adresa}", trim(d.address()));
        values.put("{telefon}", trim(d.phone()));
        values.put("{link}", trim(d.bookingLink()));
        values.put("{stop}", trim(d.stopLink()));

        String text = template == null || template.isBlank() ? DEFAULT_TEMPLATE : template.trim();
        String rendered = Arrays.stream(text.split("(?<=[.!?])\\s+"))
                .filter(sentence -> values.entrySet().stream()
                        .noneMatch(e -> sentence.contains(e.getKey()) && e.getValue().isEmpty()))
                .map(sentence -> {
                    String s = sentence;
                    for (Map.Entry<String, String> e : values.entrySet()) s = s.replace(e.getKey(), e.getValue());
                    return s;
                })
                .collect(Collectors.joining(" "))
                .trim();
        // dupa randare: altfel ar disparea odata cu o propozitie scoasa (ex. "Online: {link}" fara link)
        if (!trim(d.stopLink()).isEmpty() && !text.contains("{stop}")) rendered += "\nDezabonare: " + trim(d.stopLink());
        return plain(rendered);
    }

    // Fara diacritice si fara caractere in afara alfabetului SMS de baza (emoji etc.)
    public static String plain(String text) {
        String noMarks = Normalizer.normalize(text, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return noMarks.replace('„', '"').replace('”', '"').replace('’', '\'').replace('–', '-')
                .replaceAll("[^\\x20-\\x7E\\n]", "");
    }

    // Cate SMS-uri se taxeaza: 160 de caractere unul singur, 153 pe parte cand e lung
    public static int segments(String text) {
        int length = text.length();
        if (length <= 160) return 1;
        return (length + 152) / 153;
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }
}
