package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.StationDeadlineDTO;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.service.StationDeadlineService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

// Termenele statiei (D1): autorizatia RAR, verificari metrologice, atestatele inspectorilor
@RestController
@RequestMapping("/api/station-deadlines")
@RequiredArgsConstructor
public class StationDeadlineController {

    private final StationDeadlineService service;
    private final CurrentUser currentUser;

    @GetMapping
    public List<StationDeadlineDTO> list() {
        return service.list(station().getId(), LocalDate.now());
    }

    @PostMapping
    public ResponseEntity<StationDeadlineDTO> create(@RequestBody StationDeadlineDTO.Request request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(station().getId(), request));
    }

    @PutMapping("/{id}")
    public StationDeadlineDTO update(@PathVariable Long id, @RequestBody StationDeadlineDTO.Request request) {
        return service.update(station().getId(), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(currentUser.get().getId(), id);
        return ResponseEntity.noContent().build();
    }

    private org.example.easyitp.entity.AppUser station() {
        org.example.easyitp.entity.AppUser u = currentUser.get();
        org.example.easyitp.service.Plans.require(u, org.example.easyitp.service.Plans.Feature.STATION_DEADLINES);
        return u;
    }
}
