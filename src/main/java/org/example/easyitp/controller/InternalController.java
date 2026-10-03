package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.service.DigestService;
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
@RestController
@RequestMapping("/api/internal")
@RequiredArgsConstructor
public class InternalController {

    private final DigestService digestService;

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
        return ResponseEntity.ok(digestService.sendDailyDigests(LocalDate.now()));
    }
}
