package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.service.DailyJobService;
import org.example.easyitp.service.DigestService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;

// Apelat de GitHub Actions (.github/workflows/daily-digest.yml), cu secretul CRON_SECRET: rezerva pentru ceasul
// aplicatiei (DailyJobScheduler, 07:00), daca serverul dormea; apelul il si trezeste. Ruleaza o singura data pe zi.
@lombok.extern.slf4j.Slf4j
@RestController
@RequestMapping("/api/internal")
@RequiredArgsConstructor
public class InternalController {

    private final DailyJobService dailyJobService;

    @Value("${cron.secret:}")
    private String cronSecret;

    @PostMapping("/daily-digest")
    public ResponseEntity<DigestService.Result> dailyDigest(@RequestHeader(value = "X-Cron-Secret", required = false) String secret) {
        // Fara secret configurat endpoint-ul nu exista
        if (cronSecret == null || cronSecret.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        if (secret == null || !MessageDigest.isEqual(secret.getBytes(StandardCharsets.UTF_8), cronSecret.getBytes(StandardCharsets.UTF_8))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        // Ceasul aplicatiei ruleaza de regula la 07:00; apelul acesta e rezerva si nu dubleaza nimic
        DigestService.Result result = dailyJobService.runOnce(LocalDate.now(java.time.ZoneId.of("Europe/Bucharest")));
        if (result == null) result = new DigestService.Result(0, 0, 0);
        return ResponseEntity.ok(result);
    }
}
