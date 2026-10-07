package org.example.easyitp.service;

import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Plan;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

// Pachetele (E1): ce include fiecare, cat costa si pachetul care se aplica azi. Preturile sunt pe luna, cu TVA inclus,
// aceleasi ca in frontend (utils/plans.ts).
public final class Plans {

    public static final int TRIAL_DAYS = 14;
    public static final BigDecimal VAT_PERCENT = new BigDecimal("21");
    // 12 luni platite la pret de 10
    public static final List<Integer> MONTH_OPTIONS = List.of(1, 12);

    private static final Map<Plan, Integer> PRICES = Map.of(Plan.FREE, 0, Plan.PRO, 59, Plan.PREMIUM, 99);
    // Supliment pentru SMS-urile incluse (doar peste Pro sau Premium); aceleasi pachete ca SmsQuotaService.PLANS
    private static final Map<Integer, Integer> SMS_PRICES = Map.of(0, 0, 300, 119, 600, 229, 1000, 369);

    public enum Feature {
        AUTO_SMS(Plan.PRO, "SMS-urile automate"),
        STATION_DEADLINES(Plan.PRO, "Termenele stației"),
        OWNER_REPORTS(Plan.PRO, "Rapoartele pentru patron"),
        SCAN(Plan.PREMIUM, "Scanarea talonului"),
        FLEETS(Plan.PREMIUM, "Flotele"),
        INVOICING(Plan.PREMIUM, "Facturarea prin Oblio"),
        REVIEWS(Plan.PREMIUM, "Recenziile și nota Google");

        private final Plan plan;
        private final String label;

        Feature(Plan plan, String label) {
            this.plan = plan;
            this.label = label;
        }

        public Plan plan() {
            return plan;
        }
    }

    private Plans() {
    }

    // Pachetul care se aplica azi: dupa ultima zi platita (sau a probei) statia trece pe Gratuit, fara sa piarda date
    public static Plan effective(AppUser station, LocalDate today) {
        if (station.getPlan() == null) return Plan.PREMIUM;
        if (station.getPlanUntil() != null && today.isAfter(station.getPlanUntil())) return Plan.FREE;
        return station.getPlan();
    }

    public static Plan effective(AppUser station) {
        return effective(station, LocalDate.now());
    }

    public static boolean allows(AppUser station, Feature feature) {
        return effective(station).includes(feature.plan());
    }

    // 402 cu un mesaj pe care interfata il arata ca atare
    public static void require(AppUser station, Feature feature) {
        if (!allows(station, feature)) {
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, feature.label + " fac parte din pachetul "
                    + feature.plan.label() + ". Alegeți pachetul în Contul meu → Abonament.");
        }
    }

    public static List<String> features(AppUser station) {
        Plan plan = effective(station);
        return Arrays.stream(Feature.values()).filter(f -> plan.includes(f.plan)).map(Enum::name).toList();
    }

    // Abonamentul de proba e activ (Premium pana la planUntil)
    public static boolean onTrial(AppUser station, LocalDate today) {
        return Boolean.TRUE.equals(station.getPlanTrial()) && effective(station, today) != Plan.FREE;
    }

    public static int monthlyPrice(Plan plan, int smsPlan) {
        return PRICES.get(plan) + (plan == Plan.FREE ? 0 : SMS_PRICES.getOrDefault(smsPlan, 0));
    }

    public static boolean validSms(int smsPlan) {
        return SMS_PRICES.containsKey(smsPlan);
    }

    public static Map<Plan, Integer> prices() {
        return PRICES;
    }

    public static Map<Integer, Integer> smsPrices() {
        return SMS_PRICES;
    }

    public static int billedMonths(int months) {
        return months == 12 ? 10 : months;
    }

    // Suma de plata in RON (preturile includ deja TVA)
    public static BigDecimal amount(Plan plan, int smsPlan, int months) {
        return BigDecimal.valueOf((long) monthlyPrice(plan, smsPlan) * billedMonths(months)).setScale(2);
    }
}
