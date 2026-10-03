package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/health")
@RequiredArgsConstructor
@Slf4j
public class HealthController {

    private final JdbcTemplate jdbc;

    // Folosit pentru keep-alive (Render free adoarme dupa 15 min); nu atinge baza, ca Neon sa poata adormi
    @GetMapping
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }

    // Verificare completa (manual sau monitorizare): serverul raspunde si baza de date e accesibila
    @GetMapping("/deep")
    public ResponseEntity<Map<String, String>> deep() {
        try {
            jdbc.queryForObject("SELECT 1", Integer.class);
            return ResponseEntity.ok(Map.of("status", "UP", "database", "UP"));
        } catch (Exception e) {
            log.warn("Health: baza de date indisponibila: {}", e.getClass().getSimpleName());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("status", "DOWN", "database", "DOWN"));
        }
    }
}
