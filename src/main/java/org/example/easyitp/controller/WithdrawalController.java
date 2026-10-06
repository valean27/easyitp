package org.example.easyitp.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.example.easyitp.entity.Withdrawal;
import org.example.easyitp.repository.WithdrawalRepository;
import org.example.easyitp.security.ClientIp;
import org.example.easyitp.service.WithdrawalService;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

// Functia de retragere din contract: trimisa public din /retragere, citita de admin
@RestController
@RequiredArgsConstructor
public class WithdrawalController {

    private final WithdrawalService withdrawalService;
    private final WithdrawalRepository withdrawalRepository;

    @PostMapping("/api/public/withdrawal")
    public ResponseEntity<Map<String, String>> submit(@RequestBody WithdrawalService.WithdrawalRequest request, HttpServletRequest http) {
        withdrawalService.submit(request, ClientIp.of(http));
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message",
                "Am primit cererea de retragere. V-am trimis confirmarea pe email; vă răspundem în cel mult 14 zile."));
    }

    @GetMapping("/api/admin/withdrawals")
    public List<Withdrawal> list() {
        return withdrawalRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 200));
    }

    @PutMapping("/api/admin/withdrawals/{id}/handled")
    public Withdrawal markHandled(@PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        Withdrawal w = withdrawalRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cerere inexistentă"));
        w.setHandled(Boolean.TRUE.equals(body.get("handled")));
        return withdrawalRepository.save(w);
    }
}
