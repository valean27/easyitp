package org.example.easyitp.service;

import java.util.Objects;
import java.util.regex.Pattern;

// Celule CSV sigure pentru Excel: ghilimele cand e nevoie si fara "formula injection"
// (o valoare care incepe cu = + - @ ar fi executata ca formula la deschidere)
public final class CsvCells {

    private static final Pattern NUMBER_LIKE = Pattern.compile("[+-]?[\\d\\s().\\-/]*");

    private CsvCells() {
    }

    public static String cell(String value, char separator) {
        String v = neutralize(Objects.toString(value, ""));
        if (v.indexOf(separator) >= 0 || v.contains("\"") || v.contains("\n") || v.contains("\r")) {
            return "\"" + v.replace("\"", "\"\"") + "\"";
        }
        return v;
    }

    // Numerele de telefon (+40 722 ...) raman neatinse; restul primesc un apostrof in fata
    static String neutralize(String v) {
        if (v.isEmpty()) return v;
        char first = v.charAt(0);
        boolean risky = first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r';
        if (!risky || NUMBER_LIKE.matcher(v).matches()) return v;
        return "'" + v;
    }
}
