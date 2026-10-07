package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.PublicStationSummaryDTO;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

// "Caută stație ITP în zona ta" pe /statii: soferul scrie orasul, noi intrebam Google Places pe loc.
// Nu pastram nimic din raspuns (termenii Google). Fiecare cautare costa, deci: limita pe IP si una pe zi pentru toti.
// Statiile din Easy ITP legate de locul Google (googlePlaceId) primesc link de programare online.
@Service
public class NearbyStationsService {

    static final int MAX_PER_IP_PER_HOUR = 10;

    private final GooglePlacesService googlePlacesService;
    private final AppUserRepository appUserRepository;
    private final BookingService bookingService;
    private final SlidingWindowLimiter perIp = new SlidingWindowLimiter(MAX_PER_IP_PER_HOUR, Duration.ofHours(1));
    private final SlidingWindowLimiter daily;

    public NearbyStationsService(GooglePlacesService googlePlacesService, AppUserRepository appUserRepository,
                                 BookingService bookingService,
                                 @Value("${google.places.public-daily-cap:30}") int dailyCap) {
        this.googlePlacesService = googlePlacesService;
        this.appUserRepository = appUserRepository;
        this.bookingService = bookingService;
        this.daily = new SlidingWindowLimiter(Math.max(dailyCap, 0), Duration.ofDays(1));
    }

    // slug = pagina de programare, cand locul e al unei statii din Easy ITP
    public record NearbyStation(String name, String address, String phone, Double rating, Integer ratingCount,
                                String mapsUrl, String slug) {
    }

    public boolean available() {
        return googlePlacesService.available();
    }

    public List<NearbyStation> search(String city, String ip) {
        String q = city == null ? "" : city.trim().replaceAll("\\s+", " ");
        if (q.length() < 2 || q.length() > 60 || !q.matches("[\\p{L}\\p{M} .,'-]+")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Scrieți numele orașului (ex. Cluj-Napoca).");
        }
        if (!available()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Căutarea pe Google nu este disponibilă momentan.");
        }
        if (perIp.isBlocked(ip)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Prea multe căutări. Încercați peste o oră.");
        }
        if (!daily.tryAcquire("all")) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Căutarea pe Google a atins limita de azi. Încercați mâine.");
        }
        perIp.record(ip);
        List<GooglePlacesService.Place> places;
        try {
            places = googlePlacesService.searchItpStations(q);
        } catch (DeliveryException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, e.getMessage());
        }
        Map<String, String> slugs = listedSlugsByPlaceId();
        return places.stream()
                .filter(p -> p.name() != null)
                .map(p -> new NearbyStation(p.name(), p.address(), p.phone(), p.rating(), p.ratingCount(),
                        p.mapsUrl() != null && p.mapsUrl().startsWith("https://") ? p.mapsUrl() : null,
                        p.id() == null ? null : slugs.get(p.id())))
                .toList();
    }

    // Doar statiile din lista publica (/statii), ca sa nu aratam link spre o pagina ascunsa
    private Map<String, String> listedSlugsByPlaceId() {
        List<String> listed = bookingService.directory().stream().map(PublicStationSummaryDTO::slug).toList();
        Map<String, String> slugs = new HashMap<>();
        for (AppUser u : appUserRepository.findByRoleOrderByIdAsc(Role.MANAGER)) {
            if (u.getGooglePlaceId() != null && listed.contains(u.getBookingSlug())) {
                slugs.put(u.getGooglePlaceId(), u.getBookingSlug());
            }
        }
        return slugs;
    }
}
