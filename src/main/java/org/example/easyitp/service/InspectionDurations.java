package org.example.easyitp.service;

import org.example.easyitp.dto.VehicleTypeDTO;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Appointment;
import org.example.easyitp.entity.VehicleCategory;

import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// Durata inspectiei per tip de vehicul, salvata pe statie ca "CAR:20,FOUR_BY_FOUR:30,VAN:45".
// Tipurile care lipsesc din lista nu se pot programa online.
public final class InspectionDurations {

    public static final int MIN_MINUTES = 10;
    public static final int MAX_MINUTES = 120;
    // Programarile vechi, facute inainte de tipurile de vehicul, ocupa 30 de minute
    public static final int LEGACY_MINUTES = 30;
    private static final String DEFAULT = "CAR:20,FOUR_BY_FOUR:30,VAN:45";

    private InspectionDurations() {
    }

    // Tipurile active ale statiei, in ordinea din enum
    public static Map<VehicleCategory, Integer> of(AppUser station) {
        String raw = station.getBookingDurations() == null || station.getBookingDurations().isBlank()
                ? DEFAULT : station.getBookingDurations();
        Map<VehicleCategory, Integer> result = new EnumMap<>(VehicleCategory.class);
        for (String part : raw.split(",")) {
            String[] kv = part.trim().split(":");
            if (kv.length != 2) continue;
            try {
                result.put(VehicleCategory.valueOf(kv[0].trim()), Integer.valueOf(kv[1].trim()));
            } catch (IllegalArgumentException ignored) {
                // tip necunoscut (redenumit intre timp): il sarim
            }
        }
        return result;
    }

    public static String format(Map<VehicleCategory, Integer> durations) {
        return durations.entrySet().stream()
                .map(e -> e.getKey().name() + ":" + e.getValue())
                .collect(Collectors.joining(","));
    }

    // Toate tipurile, cu durata statiei (sau cea implicita pentru cele dezactivate) si tariful ei
    public static List<VehicleTypeDTO> allTypes(AppUser station) {
        Map<VehicleCategory, Integer> active = of(station);
        Map<VehicleCategory, Integer> prices = InspectionPrices.of(station);
        return Arrays.stream(VehicleCategory.values())
                .map(c -> new VehicleTypeDTO(c, c.label(), active.getOrDefault(c, c.defaultMinutes()), active.containsKey(c), prices.get(c)))
                .toList();
    }

    // Durata pentru un tip (si pentru un tip dezactivat, ca managerul sa poata programa orice)
    public static int minutesFor(AppUser station, VehicleCategory category) {
        if (category == null) return LEGACY_MINUTES;
        return of(station).getOrDefault(category, category.defaultMinutes());
    }

    public static int minutesOf(Appointment a) {
        return a.getDurationMinutes() != null ? a.getDurationMinutes() : LEGACY_MINUTES;
    }
}
