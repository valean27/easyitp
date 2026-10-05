package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.DeadlineReminderDTO;
import org.example.easyitp.dto.ReminderDTO;
import org.example.easyitp.entity.DeadlineKind;
import org.example.easyitp.entity.ReminderStatus;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.service.DeadlineService;
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
    private final DeadlineService deadlineService;

    @GetMapping
    public List<ReminderDTO> getReminders() {
        return itpService.getReminders(currentUser.get().getId());
    }

    // Alte scadente (RCA, rovinieta, tahograf) care expira curand
    @GetMapping("/deadlines")
    public List<DeadlineReminderDTO> getDeadlines() {
        return deadlineService.reminders(currentUser.get().getId());
    }

    // body: {"contacted": true | false}
    @PutMapping("/deadlines/{vehicleId}/{kind}")
    public ResponseEntity<Void> updateDeadline(@PathVariable Long vehicleId, @PathVariable DeadlineKind kind,
                                               @RequestBody Map<String, Boolean> body) {
        deadlineService.setContacted(currentUser.get().getId(), vehicleId, kind, Boolean.TRUE.equals(body.get("contacted")));
        return ResponseEntity.noContent().build();
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
