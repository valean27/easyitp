package org.example.easyitp.dto;

// Recenzii si vizibilitate: linkurile publice ale statiei si SMS-ul cu cererea de recenzie dupa ITP.
// Campurile google* sunt doar de citit (locul se schimba din /google-place).
public record VisibilityDTO(String reviewUrl, String mapsUrl, String facebookUrl, boolean reviewSms,
                            boolean googleAvailable, String googlePlaceId, Double googleRating, Integer googleRatingCount) {
}
