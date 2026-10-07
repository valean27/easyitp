package org.example.easyitp.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.PublicStationSummaryDTO;
import org.example.easyitp.security.ClientIp;
import org.example.easyitp.service.BookingService;
import org.example.easyitp.service.NearbyStationsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

// Lista publica a statiilor cu programare online (pagina /statii, fara login)
@RestController
@RequiredArgsConstructor
public class PublicDirectoryController {

    private final BookingService bookingService;
    private final NearbyStationsService nearbyStationsService;

    @GetMapping("/api/public/stations")
    public List<PublicStationSummaryDTO> stations() {
        return bookingService.directory();
    }

    // "Caută în zona ta": statiile ITP de pe Google dintr-un oras (in afara de /stations/{slug}, ca sa nu se bata cu un slug)
    @GetMapping("/api/public/nearby-stations/available")
    public Map<String, Boolean> nearbyAvailable() {
        return Map.of("available", nearbyStationsService.available());
    }

    @GetMapping("/api/public/nearby-stations")
    public List<NearbyStationsService.NearbyStation> nearby(@RequestParam String city, HttpServletRequest http) {
        return nearbyStationsService.search(city, ClientIp.of(http));
    }
}
