package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.DashboardDTO;
import org.example.easyitp.dto.DashboardPageDTO;
import org.example.easyitp.dto.DashboardSummaryDTO;
import org.example.easyitp.dto.ImportResultDTO;
import org.example.easyitp.dto.ItpFormDTO;
import org.example.easyitp.dto.RegistrationScanDTO;
import org.example.easyitp.entity.DeadlineKind;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.service.CsvImportService;
import org.example.easyitp.service.DeadlineService;
import org.example.easyitp.service.ItpService;
import org.example.easyitp.service.RegistrationScanService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/itp")
@RequiredArgsConstructor
public class ItpController {

    private final ItpService itpService;
    private final CsvImportService csvImportService;
    private final CurrentUser currentUser;
    private final RegistrationScanService registrationScanService;
    private final DeadlineService deadlineService;

    private static final Set<String> SCAN_IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    // Anthropic accepta imagini de pana la 5 MB (codate base64 cresc cu o treime)
    private static final long MAX_SCAN_IMAGE_BYTES = 4L * 1024 * 1024;

    // Toata statia, nepaginat (interfata foloseste /records; pastrat pentru compatibilitate)
    @GetMapping("/dashboard")
    public List<DashboardDTO> getDashboard() {
        return itpService.getDashboard(currentUser.get().getId());
    }

    // Tabelul din dashboard, paginat si filtrat pe server
    @GetMapping("/records")
    public DashboardPageDTO records(@RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "50") int size,
                                    @RequestParam(defaultValue = "") String q,
                                    @RequestParam(defaultValue = "true") boolean onlyLatest) {
        return itpService.page(currentUser.get().getId(), q, onlyLatest, page, size);
    }

    @GetMapping("/summary")
    public DashboardSummaryDTO summary() {
        return itpService.summary(currentUser.get().getId());
    }

    // Istoricul ITP al unui vehicul (dupa numar)
    @GetMapping("/history")
    public List<DashboardDTO> history(@RequestParam String plate) {
        return itpService.history(plate, currentUser.get().getId());
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

    // Alte scadente (RCA, rovinieta, tahograf) ale masinii cu acest numar, pentru formular
    @GetMapping("/deadlines")
    public Map<DeadlineKind, LocalDate> deadlines(@RequestParam String plate) {
        return deadlineService.forPlate(currentUser.get().getId(), plate);
    }

    // Un ITP (pentru fisa ITP tiparibila)
    @GetMapping("/{id}")
    public DashboardDTO get(@PathVariable Long id) {
        return itpService.get(id, currentUser.get().getId());
    }

    @PostMapping
    // Doar id-ul: entitatea serializata ar include vehicul -> client -> utilizator (cu hash-ul parolei)
    public ResponseEntity<Map<String, Long>> createItpEntry(@RequestBody ItpFormDTO form) {
        ItpRecord saved = itpService.createItpEntry(form, currentUser.get());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", saved.getId()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Void> updateItpEntry(@PathVariable Long id, @RequestBody ItpFormDTO form) {
        itpService.updateItpEntry(id, form, currentUser.get());
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/import", consumes = "multipart/form-data")
    public ResponseEntity<ImportResultDTO> importCsv(@RequestParam("file") MultipartFile file) throws IOException {
        ImportResultDTO result = csvImportService.importCsv(file, currentUser.get());
        return ResponseEntity.ok(result);
    }

    // Poza talonului -> campurile formularului ITP (poza nu se salveaza)
    @PostMapping(value = "/scan-registration", consumes = "multipart/form-data")
    public RegistrationScanDTO scanRegistration(@RequestParam("image") MultipartFile image) throws IOException {
        String type = image.getContentType() == null ? "" : image.getContentType();
        if (!SCAN_IMAGE_TYPES.contains(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trimiteți o poză JPEG, PNG sau WebP.");
        }
        if (image.isEmpty() || image.getSize() > MAX_SCAN_IMAGE_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Poza trebuie să aibă cel mult 4 MB.");
        }
        return registrationScanService.scan(currentUser.get().getId(), image.getBytes(), type);
    }

    // Antetul X-Audit-Event = intrarea din istoric, pentru butonul "Anuleaza"
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteItpRecord(@PathVariable Long id) {
        Long eventId = itpService.deleteItpRecord(id, currentUser.get());
        return ResponseEntity.noContent().header(HistoryController.EVENT_HEADER, String.valueOf(eventId)).build();
    }
}
