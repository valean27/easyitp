package org.example.easyitp.dto;

import org.example.easyitp.entity.VehicleCategory;

// Un tip de vehicul cu durata inspectiei la statie; "enabled" = se poate programa online
public record VehicleTypeDTO(VehicleCategory category, String label, int minutes, boolean enabled) {
}
