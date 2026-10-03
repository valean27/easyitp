package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.DashboardDTO;
import org.example.easyitp.dto.ImportResultDTO;
import org.example.easyitp.dto.ItpFormDTO;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.service.ItpService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/itp")
@RequiredArgsConstructor
public class ItpController {

    private final ItpService itpService;
    private final CurrentUser currentUser;

    @GetMapping("/dashboard")
    public List<DashboardDTO> getDashboard() {
        return itpService.getDashboard(currentUser.get().getId());
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportCsv() throws IOException {
        byte[] data = itpService.generateCsvExport(currentUser.get().getId());
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .header("Content-Disposition", "attachment; filename=\"itp_export.csv\"")
                .body(data);
    }

    @GetMapping("/lookup")
    public ResponseEntity<DashboardDTO> lookupByPlate(@RequestParam String plate) {
        return itpService.lookupByPlate(plate, currentUser.get().getId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping
    // Doar id-ul: entitatea serializata ar include vehicul -> client -> utilizator (cu hash-ul parolei)
    public ResponseEntity<Map<String, Long>> createItpEntry(@RequestBody ItpFormDTO form) {
        ItpRecord saved = itpService.createItpEntry(form, currentUser.get());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", saved.getId()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Void> updateItpEntry(@PathVariable Long id, @RequestBody ItpFormDTO form) {
        itpService.updateItpEntry(id, form, currentUser.get().getId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/import", consumes = "multipart/form-data")
    public ResponseEntity<ImportResultDTO> importCsv(@RequestParam("file") MultipartFile file) throws IOException {
        ImportResultDTO result = itpService.importCsv(file, currentUser.get());
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteItpRecord(@PathVariable Long id) {
        itpService.deleteItpRecord(id, currentUser.get().getId());
        return ResponseEntity.noContent().build();
    }
}
