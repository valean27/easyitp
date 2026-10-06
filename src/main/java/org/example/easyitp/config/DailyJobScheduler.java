package org.example.easyitp.config;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.service.DailyJobService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.LocalDate;
import java.time.ZoneId;

// Ceasul aplicatiei pentru rularea de dimineata: la 07:00 ora Romaniei (luni-sambata), apoi din 10 in 10 minute
// pana la 11:50, ca sa prinda ziua si daca serverul era oprit sau repornea la 7. Rularea are loc o singura data pe zi
// (DailyJobService). Serverul ramane treaz datorita monitorului UptimeRobot (/api/health la 5 minute).
@Configuration
@EnableScheduling
@RequiredArgsConstructor
@ConditionalOnProperty(name = "daily.scheduler.enabled", havingValue = "true", matchIfMissing = true)
public class DailyJobScheduler {

    static final ZoneId ROMANIA = ZoneId.of("Europe/Bucharest");

    private final DailyJobService dailyJobService;

    @Scheduled(cron = "${daily.cron:0 0/10 7-11 * * MON-SAT}", zone = "Europe/Bucharest")
    public void morning() {
        dailyJobService.runOnce(LocalDate.now(ROMANIA));
    }
}
