package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.ChangePasswordRequest;
import org.example.easyitp.dto.ProfileDTO;
import org.example.easyitp.dto.StationInfoDTO;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/account")
@RequiredArgsConstructor
public class AccountController {

    private static final int MIN_PASSWORD_LENGTH = 6;

    private final AppUserRepository appUserRepository;
    private final CurrentUser currentUser;
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

    private ProfileDTO toDto(AppUser u) {
        return new ProfileDTO(u.getEmail(), u.getRole().name(), u.getStationName(), u.getAddress(), u.getPhone(),
                u.getReminderTemplate());
    }

    private static String trimToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
