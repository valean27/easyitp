package org.example.easyitp.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalTime;
import java.util.List;

// Ce vede clientul pe pagina publica: doar datele de contact si programul statiei
@Data
@AllArgsConstructor
public class PublicStationDTO {
    private String name;
    private String address;
    private String phone;
    private LocalTime open;
    private LocalTime close;
    private List<Integer> days;
    private int maxDaysAhead;
    // Doar tipurile pe care statia le primeste online
    private List<VehicleTypeDTO> vehicleTypes;
    // Linkurile publice ale statiei (pot lipsi)
    private String mapsUrl;
    private String facebookUrl;
    private String reviewUrl;
    // Nota de pe Google (null = necunoscuta)
    private Double googleRating;
    private Integer googleRatingCount;
    // Logo-ul statiei (cale publica) si mesajul ei pe pagina de programare (pot lipsi)
    private String logoUrl;
    private String bookingMessage;
}
