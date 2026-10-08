package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.BookingSettingsDTO;
import org.example.easyitp.dto.ChangePasswordRequest;
import org.example.easyitp.dto.DigestSettingsDTO;
import org.example.easyitp.dto.ProfileDTO;
import org.example.easyitp.dto.StationInfoDTO;
import org.example.easyitp.dto.VisibilityDTO;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.DigestChannel;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.security.JwtUtil;
import org.example.easyitp.service.DeliveryException;
import org.example.easyitp.service.BookingService;
import org.example.easyitp.service.DigestService;
import org.example.easyitp.service.GooglePlacesService;
import org.example.easyitp.service.EmailService;
import org.example.easyitp.service.Plans;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/account")
@RequiredArgsConstructor
public class AccountController {

    private static final int MIN_PASSWORD_LENGTH = 6;

    private final AppUserRepository appUserRepository;
    private final CurrentUser currentUser;
    private final BookingService bookingService;
    private final org.example.easyitp.service.LogoService logoService;
    private final org.example.easyitp.service.InspectorService inspectorService;
    private final DigestService digestService;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final GooglePlacesService googlePlacesService;
    private final org.example.easyitp.service.AccountEmailService accountEmailService;
    private final org.example.easyitp.service.AccountDeletionService accountDeletionService;
    // cautari Google pe statie si zi ("id:data" -> numar); se golesc la repornire, ajunge ca frana
    private final java.util.Map<String, Integer> googleSearches = new java.util.concurrent.ConcurrentHashMap<>();
    private static final int MAX_GOOGLE_SEARCHES_PER_DAY = 20;

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

    // Recenzii si vizibilitate (C5)
    @GetMapping("/visibility")
    public VisibilityDTO getVisibility() {
        return visibility(currentUser.get());
    }

    @PutMapping("/visibility")
    public VisibilityDTO updateVisibility(@RequestBody VisibilityDTO request) {
        AppUser user = currentUser.get();
        // totul se verifica inainte de a schimba ceva
        String review = publicUrl(request.reviewUrl(), "recenzie");
        String maps = publicUrl(request.mapsUrl(), "hartă");
        String facebook = publicUrl(request.facebookUrl(), "Facebook");
        if (request.reviewSms()) {
            Plans.require(user, Plans.Feature.REVIEWS);
            if (review == null) throw badRequest("Pentru SMS-ul de recenzie completați linkul de recenzie Google.");
            if (user.getAutoSmsProvider() == null) {
                throw badRequest("Pentru SMS-ul de recenzie alegeți întâi cum se trimit SMS-urile (cardul SMS automate).");
            }
        }
        user.setReviewUrl(review);
        user.setMapsUrl(maps);
        user.setFacebookUrl(facebook);
        user.setReviewSms(request.reviewSms());
        return visibility(appUserRepository.save(user));
    }

    private static VisibilityDTO visibilityDto(AppUser u) {
        return new VisibilityDTO(u.getReviewUrl(), u.getMapsUrl(), u.getFacebookUrl(), Boolean.TRUE.equals(u.getReviewSms()),
                false, u.getGooglePlaceId(), u.getGoogleRating(), u.getGoogleRatingCount());
    }

    private VisibilityDTO visibility(AppUser u) {
        VisibilityDTO d = visibilityDto(u);
        return new VisibilityDTO(d.reviewUrl(), d.mapsUrl(), d.facebookUrl(), d.reviewSms(), googlePlacesService.available(),
                d.googlePlaceId(), d.googleRating(), d.googleRatingCount());
    }

    // Nota de pe Google: cautarea locului statiei (cel mult cateva cautari pe zi), alegerea si eliminarea lui
    @GetMapping("/google-place/search")
    public List<GooglePlacesService.Place> searchGooglePlace(@RequestParam String q) {
        AppUser user = currentUser.get();
        Plans.require(user, Plans.Feature.REVIEWS);
        String query = trimToNull(q);
        if (query == null || query.length() > 200) throw badRequest("Scrieți numele și orașul stației.");
        String key = user.getId() + ":" + java.time.LocalDate.now();
        if (googleSearches.merge(key, 1, Integer::sum) > MAX_GOOGLE_SEARCHES_PER_DAY) {
            throw badRequest("Prea multe căutări azi. Încercați mâine.");
        }
        try {
            return googlePlacesService.search(query);
        } catch (DeliveryException e) {
            throw badRequest(e.getMessage());
        }
    }

    public record GooglePlaceRequest(String placeId) {
    }

    @PutMapping("/google-place")
    public VisibilityDTO linkGooglePlace(@RequestBody GooglePlaceRequest request) {
        AppUser user = currentUser.get();
        Plans.require(user, Plans.Feature.REVIEWS);
        if (trimToNull(request.placeId()) == null) throw badRequest("Alegeți locul stației.");
        try {
            googlePlacesService.link(user, request.placeId().trim());
        } catch (DeliveryException e) {
            throw badRequest(e.getMessage());
        }
        return visibility(appUserRepository.save(user));
    }

    @DeleteMapping("/google-place")
    public VisibilityDTO unlinkGooglePlace() {
        AppUser user = currentUser.get();
        GooglePlacesService.unlink(user);
        return visibility(appUserRepository.save(user));
    }

    // Link public: gol = sters; altfel https://, fara spatii, cel mult 300 de caractere
    static String publicUrl(String raw, String what) {
        String url = trimToNull(raw);
        if (url == null) return null;
        if (!url.startsWith("https://")) url = url.startsWith("http://") ? "https://" + url.substring(7) : "https://" + url;
        if (url.length() > 300 || url.chars().anyMatch(Character::isWhitespace) || !url.matches("https://[^/?#]+\\.[^/?#]+.*")) {
            throw badRequest("Linkul pentru " + what + " nu este valid.");
        }
        return url;
    }

    // Toate datele statiei (GDPR, portabilitate): un fisier JSON
    @GetMapping("/export")
    public ResponseEntity<Map<String, Object>> exportData() {
        AppUser user = currentUser.get();
        String file = "easyitp-date-" + java.time.LocalDate.now() + ".json";
        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file + "\"")
                .body(accountDeletionService.export(user));
    }

    public record DeleteAccountRequest(String password, String confirm) {
    }

    // Stergerea contului: se inchide acum, datele se sterg definitiv dupa 30 de zile
    @PostMapping("/delete")
    public Map<String, String> deleteAccount(@RequestBody DeleteAccountRequest request) {
        java.time.LocalDateTime purgeAt = accountDeletionService.requestDeletion(currentUser.get(), request.password(), request.confirm());
        return Map.of("message", "Contul a fost închis. Datele se șterg definitiv pe "
                + purgeAt.format(java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy")) + ".");
    }

    // Retrimite linkul de confirmare a emailului (banda din aplicatie)
    @PostMapping("/resend-verification")
    public Map<String, String> resendVerification() {
        accountEmailService.resendVerification(currentUser.get());
        return Map.of("message", "Am trimis din nou emailul de confirmare. Verificați și folderul Spam.");
    }

    @PutMapping("/password")
    public Map<String, String> changePassword(@RequestBody ChangePasswordRequest request) {
        AppUser user = currentUser.get();
        if (request.getCurrentPassword() == null
                || !passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Parola curenta este gresita");
        }
        if (request.getNewPassword() == null || request.getNewPassword().length() < MIN_PASSWORD_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Parola noua trebuie sa aiba minim " + MIN_PASSWORD_LENGTH + " caractere");
        }
        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Alegeti o parola diferita de cea actuala");
        }
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        user.setPasswordChangeRequired(null);
        user.revokeTokens();
        appUserRepository.save(user);
        // Celelalte dispozitive sunt delogate; acesta continua cu un token nou
        return Map.of("token", jwtUtil.generateToken(user));
    }

    // Logo-ul statiei: PNG / JPG, refacut ca PNG de cel mult 400 px
    @PutMapping(value = "/logo", consumes = "multipart/form-data")
    public Map<String, String> uploadLogo(@RequestParam("logo") org.springframework.web.multipart.MultipartFile logo) {
        return Map.of("logoUrl", logoService.save(currentUser.get(), logo));
    }

    @DeleteMapping("/logo")
    public ResponseEntity<Void> deleteLogo() {
        logoService.delete(currentUser.get());
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

    // Numele inspectorilor activi, pentru formularul ITP si termenele statiei (echipa se gestioneaza in /api/inspectors)
    @GetMapping("/inspectors")
    public List<String> getInspectors() {
        return inspectorService.activeNames(currentUser.get());
    }

    @PutMapping("/inspectors")
    public List<String> updateInspectors(@RequestBody List<String> names) {
        return inspectorService.replaceNames(currentUser.get(), names);
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
                !Boolean.FALSE.equals(u.getDigestEnabled()), u.getReviewUrl(), u.getMapsUrl(), u.getFacebookUrl(),
                !Boolean.FALSE.equals(u.getEmailVerified()), org.example.easyitp.service.LogoService.path(u));
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static String trimToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
