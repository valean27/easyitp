package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.PublicStationSummaryDTO;
import org.example.easyitp.service.BookingService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

// Lista publica a statiilor cu programare online (pagina /statii, fara login)
@RestController
@RequiredArgsConstructor
public class PublicDirectoryController {

    private final BookingService bookingService;

    @GetMapping("/api/public/stations")
    public List<PublicStationSummaryDTO> stations() {
        return bookingService.directory();
    }
}
