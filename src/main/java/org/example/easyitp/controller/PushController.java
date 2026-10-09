package org.example.easyitp.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.service.PushService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

// Notificarile push ale contului curent (MANAGER sau INSPECTOR): cheia serverului, pornirea si oprirea pe un dispozitiv,
// o notificare de proba
@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushController {

    private final PushService pushService;
    private final CurrentUser currentUser;

    @GetMapping("/status")
    public Map<String, Object> status() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("available", pushService.available());
        out.put("publicKey", pushService.publicKey());
        out.put("devices", pushService.devices(currentUser.get()));
        return out;
    }

    @PostMapping("/subscribe")
    public Map<String, Long> subscribe(@RequestBody PushService.SubscribeRequest request, HttpServletRequest http) {
        return Map.of("devices", pushService.subscribe(currentUser.get(), request, http.getHeader("User-Agent")));
    }

    public record EndpointRequest(String endpoint) {
    }

    @PostMapping("/unsubscribe")
    public ResponseEntity<Void> unsubscribe(@RequestBody EndpointRequest request) {
        pushService.unsubscribe(currentUser.get(), request.endpoint());
        return ResponseEntity.noContent().build();
    }

    // Proba: o notificare pe toate dispozitivele contului
    @PostMapping("/test")
    public Map<String, Long> test() {
        AppUser account = currentUser.get();
        pushService.toAccounts(java.util.List.of(account.getId()), new PushService.Message("Easy ITP",
                "Notificările merg pe acest dispozitiv.", account.getInspectorId() != null ? "/" : "/calendar", "test"));
        return Map.of("devices", pushService.devices(account));
    }
}
