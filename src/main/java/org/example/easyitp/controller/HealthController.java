package org.example.easyitp.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    // Folosit pentru keep-alive (Render free adoarme dupa 15 min) si monitorizare
    @GetMapping
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }
}
