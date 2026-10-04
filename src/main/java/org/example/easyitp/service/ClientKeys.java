package org.example.easyitp.service;

import java.text.Normalizer;
import java.util.Locale;

// Chei de comparare pentru clienti: acelasi om scris putin diferit ("Ion  Pop" / "ion pop", "0722 111 222" / "+40722111222")
public final class ClientKeys {

    private ClientKeys() {
    }

    // Ultimele 9 cifre ale telefonului (numarul fara prefixul de tara/0); null daca sunt prea putine cifre.
    // Aceeasi regula e in migrarea V4, care a completat clients.phone_key pentru datele existente.
    public static String phoneKey(String phone) {
        if (phone == null) return null;
        String digits = phone.replaceAll("\\D", "");
        if (digits.isEmpty()) return null;
        return digits.length() > 9 ? digits.substring(digits.length() - 9) : digits;
    }

    // Nume fara diacritice, majuscule si spatii in plus
    public static String nameKey(String name) {
        if (name == null) return "";
        String plain = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return plain.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    public static boolean sameName(String a, String b) {
        return nameKey(a).equals(nameKey(b));
    }
}
