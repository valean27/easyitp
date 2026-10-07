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
import org.example.easyitp.service.SignupService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final LoginRateLimiter loginRateLimiter;
    private final SignupService signupService;
    private final org.example.easyitp.service.AccountEmailService accountEmailService;

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
                user.getStationName(), Boolean.TRUE.equals(user.getPasswordChangeRequired())));
    }

    // "Am uitat parola": acelasi raspuns, fie ca emailul are cont, fie ca nu
    public record ForgotRequest(String email) {
    }

    public record ResetRequest(String token, String password) {
    }

    public record TokenRequest(String token) {
    }

    @PostMapping("/forgot-password")
    public Map<String, String> forgotPassword(@RequestBody ForgotRequest request, HttpServletRequest http) {
        accountEmailService.forgotPassword(request.email(), ClientIp.of(http));
        return Map.of("message", "Dacă adresa are cont, am trimis un email cu linkul de resetare. Verificați și folderul Spam.");
    }

    @PostMapping("/reset-password")
    public Map<String, String> resetPassword(@RequestBody ResetRequest request) {
        accountEmailService.resetPassword(request.token(), request.password());
        return Map.of("message", "Parola a fost schimbată. Intrați în cont cu parola nouă.");
    }

    @PostMapping("/verify-email")
    public Map<String, String> verifyEmail(@RequestBody TokenRequest request) {
        accountEmailService.verifyEmail(request.token());
        return Map.of("message", "Adresa de email a fost confirmată. Mulțumim!");
    }

    // Inscrierea unei statii noi (pagina /inregistrare): contul e gata de folosit, cu proba Premium de 14 zile
    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@RequestBody SignupService.SignupRequest request, HttpServletRequest http) {
        AppUser user = signupService.signup(request, ClientIp.of(http));
        if (user == null) return ResponseEntity.status(HttpStatus.ACCEPTED).build();
        user.setLastLoginAt(LocalDateTime.now());
        appUserRepository.save(user);
        return ResponseEntity.status(HttpStatus.CREATED).body(new AuthResponse(jwtUtil.generateToken(user), user.getEmail(),
                user.getRole().name(), user.getStationName(), false));
    }
}
