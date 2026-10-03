package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.FleetDTOs.FleetOverviewDTO;
import org.example.easyitp.dto.FleetDTOs.FleetStatementDTO;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.service.FleetService;
import org.springframework.web.bind.annotation.*;

// Portalul firmei (rol FLEET): doar masinile si centralizatoarele firmei lui
@RestController
@RequestMapping("/api/fleet-portal")
@RequiredArgsConstructor
public class FleetPortalController {

    private final FleetService fleetService;
    private final CurrentUser currentUser;

    @GetMapping
    public FleetOverviewDTO overview() {
        return fleetService.overviewFor(currentUser.get());
    }

    @GetMapping("/statement")
    public FleetStatementDTO statement(@RequestParam String month) {
        return fleetService.statementFor(currentUser.get(), FleetController.parseMonth(month));
    }
}
