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
    // Abonamentul: pachetul de azi, cel ales (null = cont vechi), ultima zi platita, daca e proba
    private String plan;
    private String paidPlan;
    private java.time.LocalDate planUntil;
    private boolean planTrial;
    // Statia a cerut stergerea contului (datele se sterg dupa 30 de zile)
    private LocalDateTime deletionRequestedAt;
}
