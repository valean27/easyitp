package org.example.easyitp.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

// Doar cifre agregate per statie, fara datele clientilor
@Data
@Builder
public class ManagerSummaryDTO {
    private Long id;
    private String email;
    private String stationName;
    private String address;
    private String phone;
    private boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime lastLoginAt;
    private long itpCount;
    private long expiringSoonCount;
    private long expiredCount;
    private long itpThisMonth;
    private double revenueThisMonth;
    private long appointmentsThisMonth;
    // Pachetul de SMS inclus in abonament si cat a folosit statia luna aceasta
    private int smsPlan;
    private int smsUsedThisMonth;
}
