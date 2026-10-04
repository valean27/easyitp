package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.service.ClientService;
import org.springframework.web.bind.annotation.*;

// Link-ul STOP din mesajele de reamintire (fara login): clientul nu mai vrea mesaje de la statie
@RestController
@RequestMapping("/api/public/stop/{token}")
@RequiredArgsConstructor
public class PublicStopController {

    private final ClientService clientService;

    @GetMapping
    public ClientService.StopInfo info(@PathVariable String token) {
        return clientService.stopInfo(token);
    }

    @PostMapping
    public ClientService.StopInfo stop(@PathVariable String token) {
        return clientService.optOut(token);
    }
}
