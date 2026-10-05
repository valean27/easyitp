package org.example.easyitp.dto;

import org.example.easyitp.entity.DeadlineKind;
import org.example.easyitp.entity.ReminderConsent;

import java.time.LocalDate;
import java.time.LocalDateTime;

// "De contactat" -> Alte scadente: RCA / rovinieta / tahograf care expira curand sau au expirat recent
public record DeadlineReminderDTO(Long vehicleId, DeadlineKind kind, String label, LocalDate dueDate, long daysLeft,
                                  String clientName, String phone, String brand, String model, String plate,
                                  ReminderConsent consent, String stopToken, LocalDateTime contactedAt,
                                  LocalDateTime autoSmsAt) {
}
