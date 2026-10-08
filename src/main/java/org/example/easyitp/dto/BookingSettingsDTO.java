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
    // Numarul liniilor ITP (se seteaza din /api/account/lines); null la salvare = nu se schimba
    private Integer capacity;
    private List<VehicleTypeDTO> vehicleTypes;
    // Statia apare in lista publica de statii (/statii); null la salvare = nu se schimba
    private Boolean publicListing;
    // Numele liniilor (cate unul pentru fiecare linie; gol = "Linia N"); null la salvare = nu se schimba
    private List<String> lineNames;
    // Email la fiecare programare online; null la salvare = nu se schimba
    private Boolean emailNotify;
    // Mesajul de pe pagina de programare; null la salvare = nu se schimba, "" = sterge
    private String bookingMessage;
    // Pauza zilnica (ambele sau niciuna); la salvare: ambele null = fara pauza
    private LocalTime breakStart;
    private LocalTime breakEnd;
    // Inchis de sarbatorile legale; null la salvare = nu se schimba
    private Boolean holidaysClosed;
    // Tarifele apar pe pagina de programare; null la salvare = nu se schimba
    private Boolean showPrices;
    // Doar la citire: zilele inchise de statie de azi incolo si sarbatorile legale din urmatoarele 12 luni
    private List<ClosedDayDTO> closedDays;
    private List<ClosedDayDTO> holidays;
}
