package org.example.easyitp.dto;

import org.example.easyitp.entity.StationDeadlineKind;

import java.time.LocalDate;

// due = in fereastra de alerta a tipului (sau expirat): apare in dashboard si in rezumatul zilnic
public record StationDeadlineDTO(Long id, StationDeadlineKind kind, String label, String title, LocalDate dueDate,
                                 long daysLeft, String notes, boolean due) {

    public record Request(StationDeadlineKind kind, String title, LocalDate dueDate, String notes) {
    }
}
