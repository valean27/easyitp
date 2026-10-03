package org.example.easyitp.dto;

import java.util.List;

// Datele citite de pe talon; campurile necitite sunt null. "warnings" explica ce trebuie verificat de mana.
public record RegistrationScanDTO(
        String licensePlate,
        String vin,
        String brand,
        String model,
        Integer year,
        String ownerName,
        List<String> warnings) {
}
