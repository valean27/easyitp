package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.FleetDTOs.FleetAccountRequest;
import org.example.easyitp.dto.FleetDTOs.FleetDTO;
import org.example.easyitp.dto.FleetDTOs.FleetOverviewDTO;
import org.example.easyitp.dto.FleetDTOs.FleetStatementDTO;
import org.example.easyitp.dto.FleetDTOs.FleetSummaryDTO;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.service.FleetService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;

// Flotele statiei (clienti B2B), administrate de manager
@RestController
@RequestMapping("/api/fleets")
@RequiredArgsConstructor
public class FleetController {

    private final FleetService fleetService;
    private final CurrentUser currentUser;

    @GetMapping
    public List<FleetSummaryDTO> list() {
        return fleetService.list(currentUser.get());
    }

    @GetMapping("/{id}")
    public FleetDTO get(@PathVariable Long id) {
        return fleetService.get(currentUser.get(), id);
    }

    @PostMapping
    public ResponseEntity<FleetDTO> create(@RequestBody FleetDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(fleetService.create(currentUser.get(), dto));
    }

    @PutMapping("/{id}")
    public FleetDTO update(@PathVariable Long id, @RequestBody FleetDTO dto) {
        return fleetService.update(currentUser.get(), id, dto);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        fleetService.delete(currentUser.get(), id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/account")
    public FleetDTO saveAccount(@PathVariable Long id, @RequestBody FleetAccountRequest request) {
        return fleetService.saveAccount(currentUser.get(), id, request);
    }

    @DeleteMapping("/{id}/account")
    public FleetDTO deleteAccount(@PathVariable Long id) {
        return fleetService.deleteAccount(currentUser.get(), id);
    }

    @GetMapping("/{id}/overview")
    public FleetOverviewDTO overview(@PathVariable Long id) {
        return fleetService.overview(currentUser.get(), id);
    }

    @GetMapping("/{id}/statement")
    public FleetStatementDTO statement(@PathVariable Long id, @RequestParam String month) {
        return fleetService.statement(currentUser.get(), id, parseMonth(month));
    }

    // Mesajele de validare ajung in interfata ca {"message": ...}
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleStatus(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode())
                .body(Map.of("message", e.getReason() == null ? "Eroare" : e.getReason()));
    }

    static YearMonth parseMonth(String month) {
        try {
            return YearMonth.parse(month);
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Luna trebuie sa fie de forma 2026-09");
        }
    }
}
