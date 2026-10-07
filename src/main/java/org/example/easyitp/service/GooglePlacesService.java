package org.example.easyitp.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

// Nota de pe Google a statiei (stele + numar de recenzii) prin Google Places API (New). Cheia e doar in mediu
// (GOOGLE_PLACES_API_KEY); fara ea functia nu apare. Statia isi alege locul o data (cautare dupa nume + adresa),
// apoi nota se reimprospateaza in rularea zilnica la cateva zile (Google nu permite pastrarea ei mai mult de 30).
@Service
@Slf4j
public class GooglePlacesService {

    // Cat de des reimprospatam nota: ~10 cereri pe luna pe statie
    static final Duration REFRESH_AFTER = Duration.ofDays(3);

    private final String apiKey;
    private final AppUserRepository appUserRepository;
    private final RestClient client;

    public record Place(String id, String name, String address, Double rating, Integer ratingCount, String mapsUrl,
                        String phone) {
    }

    public GooglePlacesService(@Value("${google.places.api-key:}") String apiKey,
                               @Value("${google.places.url:https://places.googleapis.com/v1}") String baseUrl,
                               AppUserRepository appUserRepository) {
        this.apiKey = apiKey;
        this.appUserRepository = appUserRepository;
        this.client = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(new BufferingClientHttpRequestFactory(
                        HttpTimeouts.factory(Duration.ofSeconds(5), Duration.ofSeconds(15))))
                .build();
    }

    public boolean available() {
        return apiKey != null && !apiKey.isBlank();
    }

    // Locurile gasite dupa text (ex. "ITP Exemplu Cluj-Napoca Str. Fabricii 12"), cel mult 5
    public List<Place> search(String query) {
        JsonNode body = call(() -> client.post().uri("/places:searchText")
                .header("X-Goog-Api-Key", apiKey)
                .header("X-Goog-FieldMask", "places.id,places.displayName,places.formattedAddress,places.rating,"
                        + "places.userRatingCount,places.googleMapsUri")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("textQuery", query, "languageCode", "ro", "regionCode", "RO", "pageSize", 5))
                .retrieve().body(JsonNode.class));
        List<Place> places = new ArrayList<>();
        for (JsonNode p : body.path("places")) places.add(place(p));
        return places;
    }

    // Statiile ITP dintr-un oras, pentru soferi (pagina /statii): cautare live, nimic nu se pastreaza
    public List<Place> searchItpStations(String city) {
        JsonNode body = call(() -> client.post().uri("/places:searchText")
                .header("X-Goog-Api-Key", apiKey)
                .header("X-Goog-FieldMask", "places.id,places.displayName,places.formattedAddress,places.rating,"
                        + "places.userRatingCount,places.googleMapsUri,places.nationalPhoneNumber")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("textQuery", "stație ITP " + city, "languageCode", "ro", "regionCode", "RO", "pageSize", 20))
                .retrieve().body(JsonNode.class));
        List<Place> places = new ArrayList<>();
        for (JsonNode p : body.path("places")) places.add(place(p));
        return places;
    }

    public Place details(String placeId) {
        if (!placeId.matches("[A-Za-z0-9_-]{10,300}")) throw new DeliveryException("Locul ales nu este valid.");
        return place(call(() -> client.get().uri("/places/{id}?languageCode=ro", placeId)
                .header("X-Goog-Api-Key", apiKey)
                .header("X-Goog-FieldMask", "id,displayName,formattedAddress,rating,userRatingCount,googleMapsUri")
                .retrieve().body(JsonNode.class)));
    }

    // Leaga statia de un loc Google si ii ia nota acum
    public void link(AppUser station, String placeId) {
        Place place = details(placeId);
        station.setGooglePlaceId(place.id());
        apply(station, place);
        // fara link de harta pus de mana: il folosim pe cel de pe Google
        if (station.getMapsUrl() == null && place.mapsUrl() != null && place.mapsUrl().startsWith("https://")) {
            station.setMapsUrl(place.mapsUrl());
        }
    }

    public static void unlink(AppUser station) {
        station.setGooglePlaceId(null);
        station.setGoogleRating(null);
        station.setGoogleRatingCount(null);
        station.setGoogleRatingAt(null);
    }

    // Rularea zilnica: notele mai vechi de cateva zile; o eroare la o statie nu le opreste pe celelalte
    public int refreshAll(LocalDateTime now) {
        if (!available()) return 0;
        int refreshed = 0;
        for (AppUser station : appUserRepository.findByRoleOrderByIdAsc(Role.MANAGER)) {
            if (!station.isEnabled() || station.getGooglePlaceId() == null || !Plans.allows(station, Plans.Feature.REVIEWS)) continue;
            if (station.getGoogleRatingAt() != null && station.getGoogleRatingAt().isAfter(now.minus(REFRESH_AFTER))) continue;
            try {
                apply(station, details(station.getGooglePlaceId()));
                appUserRepository.save(station);
                refreshed++;
            } catch (DeliveryException e) {
                log.warn("Nota Google pentru statia {} nu a putut fi citita: {}", station.getId(), e.getMessage());
            }
        }
        log.info("Note Google reimprospatate: {}", refreshed);
        return refreshed;
    }

    private static void apply(AppUser station, Place place) {
        station.setGoogleRating(place.rating());
        station.setGoogleRatingCount(place.ratingCount());
        station.setGoogleRatingAt(LocalDateTime.now());
    }

    private static Place place(JsonNode p) {
        return new Place(p.path("id").asText(null), p.path("displayName").path("text").asText(null),
                p.path("formattedAddress").asText(null),
                p.hasNonNull("rating") ? p.get("rating").asDouble() : null,
                p.hasNonNull("userRatingCount") ? p.get("userRatingCount").asInt() : null,
                p.path("googleMapsUri").asText(null), p.path("nationalPhoneNumber").asText(null));
    }

    private JsonNode call(java.util.function.Supplier<JsonNode> request) {
        if (!available()) throw new DeliveryException("Nota de pe Google nu este disponibilă momentan.");
        try {
            JsonNode body = request.get();
            if (body == null) throw new DeliveryException("Google nu a răspuns.");
            return body;
        } catch (RestClientException e) {
            log.warn("Google Places: {}", e.getMessage());
            throw new DeliveryException("Google nu a răspuns. Încercați din nou.");
        }
    }
}
