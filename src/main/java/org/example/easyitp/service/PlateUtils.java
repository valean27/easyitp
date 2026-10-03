package org.example.easyitp.service;

public final class PlateUtils {

    private PlateUtils() {
    }

    // "cj 01-abc" si "CJ01ABC" sunt acelasi vehicul. Aceeasi regula e in migrarea V3 (UPPER + REPLACE), care a
    // completat coloana vehicles.normalized_plate pentru datele existente
    public static String normalize(String plate) {
        if (plate == null) return "";
        return plate.toUpperCase(java.util.Locale.ROOT).replace(" ", "").replace("-", "");
    }
}
