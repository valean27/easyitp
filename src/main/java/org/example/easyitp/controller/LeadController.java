package org.example.easyitp.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.example.easyitp.entity.Lead;
import org.example.easyitp.repository.LeadRepository;
import org.example.easyitp.security.ClientIp;
import org.example.easyitp.service.LeadService;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

// Cererile de demonstratie: trimise public din pagina de prezentare, citite de admin
@RestController
@RequiredArgsConstructor
public class LeadController {

    private final LeadService leadService;
    private final LeadRepository leadRepository;

    @PostMapping("/api/public/leads")
    public ResponseEntity<Map<String, String>> submit(@RequestBody LeadService.LeadRequest request, HttpServletRequest http) {
        leadService.submit(request, ClientIp.of(http));
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "Mulțumim! Vă contactăm în curând."));
    }

    @GetMapping("/api/admin/leads")
    public List<Lead> list() {
        return leadRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 200));
    }

    @PutMapping("/api/admin/leads/{id}/handled")
    public Lead markHandled(@PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        Lead lead = leadRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cerere inexistentă"));
        lead.setHandled(Boolean.TRUE.equals(body.get("handled")));
        return leadRepository.save(lead);
    }
}
