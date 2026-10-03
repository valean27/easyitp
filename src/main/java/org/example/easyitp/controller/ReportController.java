package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.ReportDTO;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.service.ReportService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;
    private final CurrentUser currentUser;

    // stationId e luat in calcul doar pentru admin
    @GetMapping
    public ReportDTO yearReport(@RequestParam(required = false) Integer year,
                                @RequestParam(required = false) Long stationId) {
        return reportService.yearReport(currentUser.get(), stationId, year != null ? year : LocalDate.now().getYear());
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(@RequestParam String from,
                                         @RequestParam String to,
                                         @RequestParam(required = false) Long stationId) {
        LocalDate fromDate = LocalDate.parse(from);
        LocalDate toDate = LocalDate.parse(to);
        if (toDate.isBefore(fromDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Interval invalid");
        }
        byte[] data = reportService.exportCsv(currentUser.get(), stationId, fromDate, toDate);
        String filename = "raport_itp_" + from + "_" + to + ".csv";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                .body(data);
    }
}
