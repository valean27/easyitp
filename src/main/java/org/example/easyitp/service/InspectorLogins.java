package org.example.easyitp.service;

import java.text.Normalizer;
import java.util.Locale;
import java.util.function.Predicate;

// Numele de logare al unui inspector: "prenume.nume@<adresa statiei>" (ex. ana.marin@itp-exemplu); nu e un email
// real, doar arata ca unul, ca sa intre in campul de logare existent
public final class InspectorLogins {

    private InspectorLogins() {
    }

    public static String suggest(String name, String bookingSlug, Long stationId, Predicate<String> taken) {
        String local = Normalizer.normalize(name == null ? "" : name, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", ".")
                .replaceAll("(^\\.+|\\.+$)", "");
        if (local.isEmpty()) local = "inspector";
        if (local.length() > 40) local = local.substring(0, 40).replaceAll("\\.+$", "");
        String domain = bookingSlug != null && !bookingSlug.isBlank() ? bookingSlug : "statie" + stationId;
        String login = local + "@" + domain;
        for (int i = 2; taken.test(login); i++) login = local + i + "@" + domain;
        return login;
    }

    // Litere mici, cifre, punct, cratima si un singur @ (ca emailurile, dar fara domeniu real)
    public static boolean valid(String login) {
        return login != null && login.length() <= 100 && login.matches("[a-z0-9._-]+@[a-z0-9.-]+");
    }
}
