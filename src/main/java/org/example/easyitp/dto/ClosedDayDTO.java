package org.example.easyitp.dto;

import java.time.LocalDate;

// O zi fara programari online: sarbatoare legala (holiday, cu numele ei) sau zi inchisa de statie (cu nota ei, poate lipsi)
public record ClosedDayDTO(LocalDate date, String name, boolean holiday) {
}
