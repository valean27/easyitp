package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.InspectorDTOs.Dashboard;
import org.example.easyitp.dto.InspectorDTOs.InspectorDTO;
import org.example.easyitp.dto.InspectorDTOs.InspectorRequest;
import org.example.easyitp.dto.InspectorDTOs.LineShiftDTO;
import org.example.easyitp.dto.InspectorDTOs.LineShiftRequest;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.service.InspectorDashboardService;
import org.example.easyitp.service.InspectorService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

// Echipa de inspectori (MANAGER): lista, cine e pe ce linie intr-o zi si dashboard-ul (Pro)
@RestController
@RequestMapping("/api/inspectors")
@RequiredArgsConstructor
public class InspectorController {

    private final InspectorService service;
    private final InspectorDashboardService dashboardService;
    private final CurrentUser currentUser;

    @GetMapping
    public List<InspectorDTO> list() {
        return service.list(currentUser.get());
    }

    @PostMapping
    public ResponseEntity<InspectorDTO> create(@RequestBody InspectorRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(currentUser.get(), request));
    }

    @PutMapping("/{id}")
    public InspectorDTO update(@PathVariable Long id, @RequestBody InspectorRequest request) {
        return service.update(currentUser.get(), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(currentUser.get(), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/shifts")
    public List<LineShiftDTO> shifts(@RequestParam LocalDate date) {
        return service.shifts(currentUser.get(), date);
    }

    @PutMapping("/shifts")
    public List<LineShiftDTO> setShift(@RequestBody LineShiftRequest request) {
        return service.setShift(currentUser.get(), request);
    }

    @GetMapping("/dashboard")
    public Dashboard dashboard(@RequestParam LocalDate from, @RequestParam LocalDate to) {
        return dashboardService.dashboard(currentUser.get(), from, to, LocalDate.now());
    }
}
