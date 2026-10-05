package org.example.easyitp.dto;

// Recenzii si vizibilitate: linkurile publice ale statiei si SMS-ul cu cererea de recenzie dupa ITP
public record VisibilityDTO(String reviewUrl, String mapsUrl, String facebookUrl, boolean reviewSms) {
}
