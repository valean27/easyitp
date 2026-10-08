package org.example.easyitp.dto;

import java.time.LocalDate;

// Inchide statia in zilele [from, to] (to lipsa = doar from), cu o nota optionala (ex. "Inventar")
public record ClosedDaysRequest(LocalDate from, LocalDate to, String note) {
}
