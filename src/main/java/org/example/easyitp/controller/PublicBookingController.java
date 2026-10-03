package org.example.easyitp.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.PublicBookingRequest;
import org.example.easyitp.dto.PublicStationDTO;
import org.example.easyitp.entity.Appointment;
import org.example.easyitp.entity.VehicleCategory;
import org.example.easyitp.security.ClientIp;
import org.example.easyitp.service.BookingRateLimiter;
import org.example.easyitp.service.BookingService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

// Endpoint-uri fara autentificare pentru pagina publica de programare
@RestController
@RequestMapping("/api/public/stations/{slug}")
@RequiredArgsConstructor
public class PublicBookingController {

    private final BookingService bookingService;
    private final BookingRateLimiter rateLimiter;

    @GetMapping
    public PublicStationDTO station(@PathVariable String slug) {
        return bookingService.publicStation(slug);
    }

    @GetMapping("/slots")
    public List<LocalTime> slots(@PathVariable String slug, @RequestParam String date,
                                 @RequestParam(required = false) VehicleCategory category) {
        return bookingService.availableSlots(slug, LocalDate.parse(date), category);
    }

    @PostMapping("/appointments")
    public ResponseEntity<Map<String, Object>> book(@PathVariable String slug,
                                                    @RequestBody PublicBookingRequest request,
                                                    HttpServletRequest http) {
        // Botii completeaza campul ascuns: le raspundem ca si cum ar fi reusit, fara sa salvam nimic
        if (request.getWebsite() != null && !request.getWebsite().isBlank()) {
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of());
        }
        if (!rateLimiter.tryAcquire(ClientIp.of(http))) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Prea multe programari. Incercati mai tarziu.");
        }
        Appointment saved = bookingService.book(slug, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("appointmentDate", saved.getAppointmentDate()));
    }
}
