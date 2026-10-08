package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.service.LogoService;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

// Logo-ul statiei, public (pagina de programare, emailuri). Tokenul se schimba la fiecare logo nou, deci se poate
// tine in cache un an.
@RestController
@RequiredArgsConstructor
public class PublicLogoController {

    private final LogoService logoService;

    @GetMapping("/api/public/logos/{token}.png")
    public ResponseEntity<byte[]> logo(@PathVariable String token) {
        return logoService.image(token)
                .map(png -> ResponseEntity.ok()
                        .contentType(MediaType.IMAGE_PNG)
                        .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                        .header("X-Content-Type-Options", "nosniff")
                        .body(png))
                .orElse(ResponseEntity.notFound().build());
    }
}
