package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.BookingSettingsDTO;
import org.example.easyitp.dto.ChangePasswordRequest;
import org.example.easyitp.dto.DigestSettingsDTO;
import org.example.easyitp.dto.ProfileDTO;
import org.example.easyitp.dto.StationInfoDTO;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.DigestChannel;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.service.DeliveryException;
import org.example.easyitp.service.BookingService;
import org.example.easyitp.service.DigestService;
import org.example.easyitp.service.EmailService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/account")
@RequiredArgsConstructor
public class AccountController {

    private static final int MIN_PASSWORD_LENGTH = 6;

    private final AppUserRepository appUserRepository;
    private final CurrentUser currentUser;
    private final BookingService bookingService;
    private final DigestService digestService;
    private final PasswordEncoder passwordEncoder;

    @GetMapping("/me")
    public ProfileDTO getProfile() {
        return toDto(currentUser.get());
    }

    @PutMapping("/me")
    public ProfileDTO updateProfile(@RequestBody StationInfoDTO request) {
        AppUser user = currentUser.get();
        user.setStationName(trimToNull(request.getStationName()));
        user.setAddress(trimToNull(request.getAddress()));
        user.setPhone(trimToNull(request.getPhone()));
        user.setReminderTemplate(trimToNull(request.getReminderTemplate()));
        return toDto(appUserRepository.save(user));
    }

    @PutMapping("/password")
    public ResponseEntity<Void> changePassword(@RequestBody ChangePasswordRequest request) {
        AppUser user = currentUser.get();
        if (request.getCurrentPassword() == null
                || !passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Parola curenta este gresita");
        }
        if (request.getNewPassword() == null || request.getNewPassword().length() < MIN_PASSWORD_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Parola noua trebuie sa aiba minim " + MIN_PASSWORD_LENGTH + " caractere");
        }
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        appUserRepository.save(user);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/booking")
    public BookingSettingsDTO getBookingSettings() {
        return bookingService.getSettings(currentUser.get());
    }

    @PutMapping("/booking")
    public BookingSettingsDTO updateBookingSettings(@RequestBody BookingSettingsDTO request) {
        return bookingService.updateSettings(currentUser.get(), request);
    }

    @GetMapping("/digest")
    public DigestSettingsDTO getDigestSettings() {
        return digestSettings(currentUser.get());
    }

    // Raspunde cu {"message": ...} la date invalide, ca interfata sa poata afisa motivul
    @PutMapping("/digest")
    public ResponseEntity<?> updateDigest(@RequestBody DigestSettingsDTO request) {
        AppUser user = currentUser.get();
        DigestChannel channel = request.getChannel() != null ? request.getChannel() : DigestChannel.EMAIL;
        String newKey = request.getCallmebotApiKey() == null ? "" : request.getCallmebotApiKey().trim();
        String phone = trimToNull(request.getWhatsappPhone());

        if (channel == DigestChannel.WHATSAPP && request.isEnabled()) {
            if (phone == null || phone.replaceAll("\\D", "").length() < 10) {
                return ResponseEntity.badRequest().body(Map.of("message", "Introduceți numărul de WhatsApp pe care primiți mesajele."));
            }
            if (newKey.isEmpty() && user.getCallmebotApiKey() == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "Introduceți cheia primită de la CallMeBot."));
            }
        }
        user.setDigestEnabled(request.isEnabled());
        user.setDigestChannel(channel);
        user.setWhatsappPhone(phone);
        if (!newKey.isEmpty()) user.setCallmebotApiKey(newKey);
        return ResponseEntity.ok(digestSettings(appUserRepository.save(user)));
    }

    private static DigestSettingsDTO digestSettings(AppUser u) {
        return new DigestSettingsDTO(
                !Boolean.FALSE.equals(u.getDigestEnabled()),
                u.getDigestChannel() != null ? u.getDigestChannel() : DigestChannel.EMAIL,
                u.getWhatsappPhone() != null ? u.getWhatsappPhone() : u.getPhone(),
                null,
                u.getCallmebotApiKey() != null);
    }

    // Trimite acum emailul zilnic catre utilizatorul logat; mesajul de eroare ajunge in interfata
    @PostMapping("/digest/test")
    public ResponseEntity<Map<String, String>> sendTestDigest() {
        try {
            digestService.sendTest(currentUser.get());
            return ResponseEntity.ok(Map.of("message", "Emailul a fost trimis."));
        } catch (DeliveryException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("message", e.getMessage()));
        }
    }

    private ProfileDTO toDto(AppUser u) {
        return new ProfileDTO(u.getEmail(), u.getRole().name(), u.getStationName(), u.getAddress(), u.getPhone(),
                u.getReminderTemplate(), u.getBookingSlug(), Boolean.TRUE.equals(u.getBookingEnabled()),
                !Boolean.FALSE.equals(u.getDigestEnabled()));
    }

    private static String trimToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
