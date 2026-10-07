package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.AppointmentDTO;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.service.InspectorPortalService;
import org.example.easyitp.service.InspectorPortalService.Day;
import org.example.easyitp.service.InspectorPortalService.Me;
import org.example.easyitp.service.InspectorPortalService.StatusRequest;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

// Contul propriu al inspectorului (rol INSPECTOR): ziua lui si programarile lui
@RestController
@RequestMapping("/api/inspector-portal")
@RequiredArgsConstructor
public class InspectorPortalController {

    private final InspectorPortalService service;
    private final CurrentUser currentUser;

    @GetMapping("/me")
    public Me me() {
        return service.me(currentUser.get());
    }

    @GetMapping("/day")
    public Day day(@RequestParam LocalDate date) {
        return service.day(currentUser.get(), date);
    }

    @PutMapping("/appointments/{id}/status")
    public AppointmentDTO setStatus(@PathVariable Long id, @RequestBody StatusRequest request) {
        return service.setStatus(currentUser.get(), id, request.status());
    }
}
