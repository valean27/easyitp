package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.ReminderDTO;
import org.example.easyitp.entity.ReminderStatus;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.service.ItpService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reminders")
@RequiredArgsConstructor
public class ReminderController {

    private final ItpService itpService;
    private final CurrentUser currentUser;

    @GetMapping
    public List<ReminderDTO> getReminders() {
        return itpService.getReminders(currentUser.get().getId());
    }

    // body: {"status": "CONTACTED" | "SCHEDULED" | "NOT_INTERESTED" | null}
    @PutMapping("/{id}")
    public ResponseEntity<Void> updateReminder(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String raw = body.get("status");
        ReminderStatus status;
        try {
            status = raw == null || raw.isBlank() ? null : ReminderStatus.valueOf(raw);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status invalid");
        }
        itpService.updateReminder(id, currentUser.get().getId(), status);
        return ResponseEntity.noContent().build();
    }
}
