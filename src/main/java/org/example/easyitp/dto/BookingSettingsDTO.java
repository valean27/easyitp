package org.example.easyitp.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalTime;
import java.util.List;

// Setarile programarii online ale unei statii (editate de manager in "Contul meu")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BookingSettingsDTO {
    private boolean enabled;
    private String slug;
    private LocalTime open;
    private LocalTime close;
    private List<Integer> days; // 1 = luni ... 7 = duminica
    private int capacity;
    private List<VehicleTypeDTO> vehicleTypes;
    // Statia apare in lista publica de statii (/statii); null la salvare = nu se schimba
    private Boolean publicListing;
    // Numele liniilor (cate unul pentru fiecare linie; gol = "Linia N"); null la salvare = nu se schimba
    private List<String> lineNames;
}
