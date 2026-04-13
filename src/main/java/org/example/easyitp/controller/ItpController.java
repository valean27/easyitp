package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.DashboardDTO;
import org.example.easyitp.dto.ImportResultDTO;
import org.example.easyitp.dto.ItpFormDTO;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.service.ItpService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/itp")
@RequiredArgsConstructor
public class ItpController {

    private final ItpService itpService;
    private final AppUserRepository appUserRepository;

    private AppUser currentUser() {
        String email = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return appUserRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    @GetMapping("/dashboard")
    public List<DashboardDTO> getDashboard() {
        return itpService.getDashboard(currentUser().getId());
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportCsv() throws IOException {
        byte[] data = itpService.generateCsvExport(currentUser().getId());
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .header("Content-Disposition", "attachment; filename=\"itp_export.csv\"")
                .body(data);
    }

    @PostMapping
    public ResponseEntity<ItpRecord> createItpEntry(@RequestBody ItpFormDTO form) {
        ItpRecord saved = itpService.createItpEntry(form, currentUser());
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PostMapping(value = "/import", consumes = "multipart/form-data")
    public ResponseEntity<ImportResultDTO> importCsv(@RequestParam("file") MultipartFile file) throws IOException {
        ImportResultDTO result = itpService.importCsv(file, currentUser());
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteItpRecord(@PathVariable Long id) {
        itpService.deleteItpRecord(id, currentUser().getId());
        return ResponseEntity.noContent().build();
    }
}
