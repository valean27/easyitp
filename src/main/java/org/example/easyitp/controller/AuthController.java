package org.example.easyitp.controller;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.AuthResponse;
import org.example.easyitp.dto.LoginRequest;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.security.ClientIp;
import org.example.easyitp.security.JwtUtil;
import org.example.easyitp.service.LoginRateLimiter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final LoginRateLimiter loginRateLimiter;

    // Hash bcrypt al unei parole aleatoare: pentru un email inexistent verificam totusi o parola, ca timpul
    // de raspuns sa nu arate daca emailul are cont
    private String dummyHash;

    @PostConstruct
    void initDummyHash() {
        dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request, HttpServletRequest http) {
        String email = request.getEmail() == null ? "" : request.getEmail().trim().toLowerCase(Locale.ROOT);
        String password = request.getPassword() == null ? "" : request.getPassword();
        String ip = ClientIp.of(http);
        if (loginRateLimiter.isBlocked(ip, email)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Prea multe încercări greșite. Încercați din nou peste 15 minute.");
        }

        AppUser user = appUserRepository.findByEmailIgnoreCase(email).orElse(null);
        boolean passwordOk = passwordEncoder.matches(password, user != null ? user.getPassword() : dummyHash);
        if (user == null || !passwordOk) {
            loginRateLimiter.recordFailure(ip, email);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        loginRateLimiter.recordSuccess(email);
        if (!user.isEnabled()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        user.setLastLoginAt(LocalDateTime.now());
        appUserRepository.save(user);
        return ResponseEntity.ok(new AuthResponse(jwtUtil.generateToken(user), user.getEmail(), user.getRole().name(),
                user.getStationName()));
    }
}
