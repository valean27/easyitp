package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

// Clopotelul din aplicatie (MANAGER): ultimele notificari, cate sunt necitite, marcarea ca citite
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService service;
    private final CurrentUser currentUser;

    @GetMapping
    public NotificationService.Inbox inbox() {
        return service.inbox(currentUser.get().getId());
    }

    // Doar numarul (interfata il cere la un minut)
    @GetMapping("/unread-count")
    public Map<String, Long> unread() {
        return Map.of("unread", service.unread(currentUser.get().getId()));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<Void> read(@PathVariable Long id) {
        service.markRead(currentUser.get().getId(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/read-all")
    public ResponseEntity<Void> readAll() {
        service.markAllRead(currentUser.get().getId());
        return ResponseEntity.noContent().build();
    }
}
