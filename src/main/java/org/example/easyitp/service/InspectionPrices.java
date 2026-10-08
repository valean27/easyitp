package org.example.easyitp.service;

import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.VehicleCategory;

import java.util.EnumMap;
import java.util.Map;
import java.util.stream.Collectors;

// Tariful ITP per tip de vehicul, salvat pe statie ca "CAR:180,VAN:220" (lei, cu TVA). Tip lipsa = fara tarif.
public final class InspectionPrices {

    public static final int MAX_PRICE = 10_000;

    private InspectionPrices() {
    }

    public static Map<VehicleCategory, Integer> of(AppUser station) {
        Map<VehicleCategory, Integer> result = new EnumMap<>(VehicleCategory.class);
        if (station.getBookingPrices() == null || station.getBookingPrices().isBlank()) return result;
        for (String part : station.getBookingPrices().split(",")) {
            String[] kv = part.trim().split(":");
            if (kv.length != 2) continue;
            try {
                result.put(VehicleCategory.valueOf(kv[0].trim()), Integer.valueOf(kv[1].trim()));
            } catch (IllegalArgumentException ignored) {
                // tip necunoscut sau valoare stricata: o sarim
            }
        }
        return result;
    }

    // null = niciun tarif
    public static String format(Map<VehicleCategory, Integer> prices) {
        String raw = prices.entrySet().stream()
                .map(e -> e.getKey().name() + ":" + e.getValue())
                .collect(Collectors.joining(","));
        return raw.isEmpty() ? null : raw;
    }

    // Tariful pentru un tip (null = fara tarif sau programare veche fara tip)
    public static Integer priceFor(AppUser station, VehicleCategory category) {
        return category == null ? null : of(station).get(category);
    }
}
