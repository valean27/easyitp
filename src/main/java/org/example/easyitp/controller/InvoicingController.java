package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.InvoicingDTOs.InvoiceDTO;
import org.example.easyitp.dto.InvoicingDTOs.OptionsDTO;
import org.example.easyitp.dto.InvoicingDTOs.SettingsDTO;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.service.InvoiceService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

// Facturare prin Oblio: setarile statiei, optiunile din contul Oblio, facturile pentru flote si pentru ITP-uri
@RestController
@RequestMapping("/api/invoicing")
@RequiredArgsConstructor
public class InvoicingController {

    private final InvoiceService invoiceService;
    private final CurrentUser currentUser;

    @GetMapping("/settings")
    public SettingsDTO settings() {
        return InvoiceService.settings(currentUser.get());
    }

    @PutMapping("/settings")
    public SettingsDTO update(@RequestBody SettingsDTO request) {
        return invoiceService.update(currentUser.get(), request);
    }

    @GetMapping("/options")
    public OptionsDTO options(@RequestParam(required = false) String cif) {
        return invoiceService.options(currentUser.get(), cif);
    }

    @GetMapping("/fleets/{fleetId}")
    public ResponseEntity<InvoiceDTO> fleetInvoice(@PathVariable Long fleetId, @RequestParam String month) {
        return invoiceService.fleetInvoice(currentUser.get(), fleetId, FleetController.parseMonth(month))
                .map(ResponseEntity::ok).orElse(ResponseEntity.noContent().build());
    }

    @PostMapping("/fleets/{fleetId}")
    public ResponseEntity<InvoiceDTO> issueForFleet(@PathVariable Long fleetId, @RequestParam String month) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(invoiceService.issueForFleet(currentUser.get(), fleetId, FleetController.parseMonth(month)));
    }

    @GetMapping("/itp/{itpId}")
    public ResponseEntity<InvoiceDTO> itpInvoice(@PathVariable Long itpId) {
        return invoiceService.itpInvoice(currentUser.get(), itpId).map(ResponseEntity::ok).orElse(ResponseEntity.noContent().build());
    }

    @PostMapping("/itp/{itpId}")
    public ResponseEntity<InvoiceDTO> issueForItp(@PathVariable Long itpId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(invoiceService.issueForItp(currentUser.get(), itpId));
    }
}
