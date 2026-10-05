package org.example.easyitp.dto;

import java.time.LocalTime;
import java.util.List;

// O statie din lista publica (pagina /statii): datele de contact si programul, plus link-ul de programare
public record PublicStationSummaryDTO(String name, String slug, String address, String phone, LocalTime open,
                                      LocalTime close, List<Integer> days, String mapsUrl, Double googleRating,
                                      Integer googleRatingCount) {
}
