package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.AppointmentDTO;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.service.AppointmentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/appointments")
@RequiredArgsConstructor
public class AppointmentController {

    private final AppointmentService appointmentService;
    private final AppUserRepository appUserRepository;

    private AppUser currentUser() {
        String email = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return appUserRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    @GetMapping
    public List<AppointmentDTO> getAppointments(
            @RequestParam String start,
            @RequestParam String end) {
        LocalDateTime startDt = LocalDateTime.parse(start);
        LocalDateTime endDt = LocalDateTime.parse(end);
        return appointmentService.getAppointments(currentUser().getId(), startDt, endDt);
    }

    @PostMapping
    public ResponseEntity<AppointmentDTO> create(@RequestBody AppointmentDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(appointmentService.create(dto, currentUser()));
    }

    @PutMapping("/{id}")
    public AppointmentDTO update(@PathVariable Long id, @RequestBody AppointmentDTO dto) {
        return appointmentService.update(id, dto, currentUser().getId());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        appointmentService.delete(id, currentUser().getId());
        return ResponseEntity.noContent().build();
    }
}
