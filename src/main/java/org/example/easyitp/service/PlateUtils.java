package org.example.easyitp.service;

public final class PlateUtils {

    private PlateUtils() {
    }

    // "cj 01-abc" si "CJ01ABC" sunt acelasi vehicul; aceeasi regula ca in VehicleRepository.findByNormalizedPlate
    public static String normalize(String plate) {
        if (plate == null) return "";
        return plate.toUpperCase().replace(" ", "").replace("-", "");
    }
}
