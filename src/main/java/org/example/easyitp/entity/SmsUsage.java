package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

// SMS-urile folosite de o statie din pachetul "inclus in abonament", pe o luna (parti taxate, nu mesaje)
@Entity
@Table(name = "sms_usage", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "period"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SmsUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    // "2026-10"
    @Column(name = "period", nullable = false, length = 7)
    private String month;

    @Column(nullable = false)
    private Integer sent;
}
