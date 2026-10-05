package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Client;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.entity.ItpStatus;
import org.example.easyitp.entity.ReminderConsent;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.ItpRecordRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

// Recenzii (C5): in dimineata de dupa un ITP admis, un SMS cu linkul de recenzie Google al statiei, pe canalul SMS
// al statiei. Doar clientilor cu acord pentru mesaje, o data pe ITP si cel mult o data pe an pe client.
@Service
@RequiredArgsConstructor
@Slf4j
public class ReviewRequestService {

    public static final String TEMPLATE = "{statie}: Multumim ca ati ales statia noastra! Ne lasati o parere? {link}";
    // Lunea prinde si ITP-urile de sambata (duminica nu ruleaza)
    static final int LOOK_BACK_DAYS = 3;
    static final int MAX_PER_STATION_PER_DAY = 100;

    private final AppUserRepository appUserRepository;
    private final ItpRecordRepository itpRecordRepository;
    private final SmsSender smsSender;

    @Value("${app.url:https://easyitp.vercel.app}")
    private String appUrl;

    public record RunResult(int sent, int failed) {
    }

    public RunResult runDaily(LocalDate today) {
        int sent = 0, failed = 0;
        for (AppUser station : appUserRepository.findByRoleOrderByIdAsc(Role.MANAGER)) {
            if (!station.isEnabled() || !Boolean.TRUE.equals(station.getReviewSms()) || station.getReviewUrl() == null
                    || station.getAutoSmsProvider() == null) {
                continue;
            }
            Set<Long> asked = new HashSet<>();
            int stationSent = 0;
            for (ItpRecord r : itpRecordRepository.findWithoutReviewRequest(station.getId(), today.minusDays(LOOK_BACK_DAYS),
                    today.minusDays(1))) {
                Client c = r.getVehicle().getClient();
                if (r.getStatus() != ItpStatus.PASSED || c.getReminderConsent() != ReminderConsent.GIVEN
                        || SmsSender.phoneDigits(c.getPhone()) == null || asked.contains(c.getId())
                        || itpRecordRepository.reviewRequestedSince(c.getId(), today.minusYears(1).atStartOfDay())) {
                    continue;
                }
                if (stationSent >= MAX_PER_STATION_PER_DAY) break;
                asked.add(c.getId());
                try {
                    smsSender.send(station, c.getPhone(), text(station, c));
                    r.setReviewRequestedAt(LocalDateTime.now());
                    itpRecordRepository.save(r);
                    sent++;
                    stationSent++;
                } catch (DeliveryException e) {
                    log.warn("Cererea de recenzie pentru ITP-ul {} nu a plecat: {}", r.getId(), e.getMessage());
                    failed++;
                }
            }
        }
        log.info("Cereri de recenzie {}: {} trimise, {} esuate", today, sent, failed);
        return new RunResult(sent, failed);
    }

    String text(AppUser station, Client c) {
        return SmsText.render(TEMPLATE.replace("{link}", station.getReviewUrl()), new SmsText.Data(c.getName(), null, null,
                null, false, station.getStationName(), station.getAddress(), station.getPhone(), null,
                c.getOptOutToken() == null ? null : appUrl + "/s/" + c.getOptOutToken()));
    }
}
