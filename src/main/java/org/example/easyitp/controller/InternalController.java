package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.service.DigestService;
import org.example.easyitp.service.AppointmentSmsService;
import org.example.easyitp.service.AutoReminderService;
import org.example.easyitp.service.HistoryService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;

// Apelat de GitHub Actions dimineata (.github/workflows/daily-digest.yml), cu secretul CRON_SECRET.
// Pe Render free un job programat in aplicatie nu ar rula cand serverul doarme; apelul extern il si trezeste.
@lombok.extern.slf4j.Slf4j
@RestController
@RequestMapping("/api/internal")
@RequiredArgsConstructor
public class InternalController {

    private final DigestService digestService;
    private final HistoryService historyService;
    private final AutoReminderService autoReminderService;
    private final AppointmentSmsService appointmentSmsService;

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
        DigestService.Result result = digestService.sendDailyDigests(LocalDate.now());
        // Tot o data pe zi: SMS-urile automate catre clienti si curatarea istoricului mai vechi de un an.
        // O eroare aici nu strica rezumatul deja trimis.
        try {
            autoReminderService.runDaily(LocalDate.now());
        } catch (RuntimeException e) {
            log.error("SMS-urile automate au esuat", e);
        }
        try {
            appointmentSmsService.runDayBefore(LocalDate.now());
        } catch (RuntimeException e) {
            log.error("Reminderele pentru programari au esuat", e);
        }
        historyService.purgeOld();
        return ResponseEntity.ok(result);
    }
}
