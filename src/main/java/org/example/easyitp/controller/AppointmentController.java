package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.AppointmentDTO;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.service.AppointmentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/appointments")
@RequiredArgsConstructor
public class AppointmentController {

    private final AppointmentService appointmentService;
    private final CurrentUser currentUser;

    @GetMapping
    public List<AppointmentDTO> getAppointments(
            @RequestParam String start,
            @RequestParam String end) {
        LocalDateTime startDt = LocalDateTime.parse(start);
        LocalDateTime endDt = LocalDateTime.parse(end);
        return appointmentService.getAppointments(currentUser.get().getId(), startDt, endDt);
    }

    @GetMapping("/conflicts")
    public List<AppointmentDTO> getConflicts(@RequestParam String date,
                                             @RequestParam(required = false) Long excludeId) {
        return appointmentService.getConflicts(currentUser.get().getId(), LocalDateTime.parse(date), excludeId);
    }

    @PostMapping
    public ResponseEntity<AppointmentDTO> create(@RequestBody AppointmentDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(appointmentService.create(dto, currentUser.get()));
    }

    @PutMapping("/{id}")
    public AppointmentDTO update(@PathVariable Long id, @RequestBody AppointmentDTO dto) {
        return appointmentService.update(id, dto, currentUser.get().getId());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        appointmentService.delete(id, currentUser.get().getId());
        return ResponseEntity.noContent().build();
    }
}
