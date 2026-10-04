package org.example.easyitp.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import org.example.easyitp.entity.ReminderConsent;
import org.example.easyitp.entity.ReminderStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class ReminderDTO {
    private Long id;
    private String numeSofer;
    private String contact;
    private String marca;
    private String model;
    private String numarInmatriculare;
    private LocalDate dataUrmatorItp;
    private long zileRamase;
    private ReminderStatus reminderStatus;
    private LocalDateTime reminderAt;
    // Acordul clientului (null = necunoscut) si token-ul link-ului STOP pus in mesaj
    private ReminderConsent consent;
    private String stopToken;
    // Cand a plecat ultimul SMS automat pentru acest ITP (null = niciunul)
    private LocalDateTime autoSmsAt;
}
