package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.SmsUsage;
import org.example.easyitp.repository.SmsUsageRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.YearMonth;
import java.util.List;
import java.util.Set;

// Pachetul de SMS "inclus in abonament": cont SMSLink al platformei (variabile de mediu, nu in baza de date) si
// cate SMS pe luna are fiecare statie (AppUser.smsPlan, setat de admin)
@Service
@RequiredArgsConstructor
public class SmsQuotaService {

    // Pachetele vandute (SMS pe luna); 0 = fara pachet
    public static final List<Integer> PLANS = List.of(0, 300, 600, 1000);
    private static final Set<Integer> ALLOWED = Set.copyOf(PLANS);

    private final SmsUsageRepository smsUsageRepository;

    @Value("${platform.smslink.connection-id:}")
    private String connectionId;

    @Value("${platform.smslink.password:}")
    private String password;

    // Contul platformei e configurat pe server (SMSLINK_CONNECTION_ID / SMSLINK_PASSWORD)
    public boolean platformAvailable() {
        return connectionId != null && !connectionId.isBlank() && password != null && !password.isBlank();
    }

    public String connectionId() {
        return connectionId;
    }

    public String password() {
        return password;
    }

    public static boolean validPlan(Integer plan) {
        return plan != null && ALLOWED.contains(plan);
    }

    // Pe pachetul Gratuit (abonament expirat) SMS-urile incluse nu se mai trimit
    public static int plan(AppUser station) {
        if (station.getSmsPlan() == null || Plans.effective(station) == org.example.easyitp.entity.Plan.FREE) return 0;
        return station.getSmsPlan();
    }

    public int usedThisMonth(Long userId) {
        return smsUsageRepository.findByUserIdAndMonth(userId, YearMonth.now().toString()).map(SmsUsage::getSent).orElse(0);
    }

    // Opreste trimiterea daca mesajul (cu toate partile lui) nu mai incape in pachetul lunii
    public void checkRoom(AppUser station, int parts) {
        int plan = plan(station);
        if (plan <= 0) throw new DeliveryException("Stația nu are un pachet de SMS inclus în abonament.");
        int used = usedThisMonth(station.getId());
        if (used + parts > plan) {
            throw new DeliveryException("Pachetul de SMS al lunii s-a terminat (" + used + " / " + plan + "). Se reia luna viitoare.");
        }
    }

    @Transactional
    public void record(AppUser station, int parts) {
        String month = YearMonth.now().toString();
        SmsUsage usage = smsUsageRepository.findByUserIdAndMonth(station.getId(), month)
                .orElseGet(() -> SmsUsage.builder().userId(station.getId()).month(month).sent(0).build());
        usage.setSent(usage.getSent() + parts);
        smsUsageRepository.save(usage);
    }
}
