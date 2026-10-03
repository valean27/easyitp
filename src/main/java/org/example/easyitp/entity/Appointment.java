package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "appointments")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Appointment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "client_name", nullable = false)
    private String clientName;

    @Column(name = "phone")
    private String phone;

    @Column(name = "license_plate")
    private String licensePlate;

    @Column(name = "appointment_date", nullable = false)
    private LocalDateTime appointmentDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private AppointmentStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", length = 20)
    private AppointmentSource source;

    // null la programarile facute inainte de tipurile de vehicul
    @Enumerated(EnumType.STRING)
    @Column(name = "vehicle_category", length = 20)
    private VehicleCategory vehicleCategory;

    // Cat timp ocupa linia; null = 30 de minute (programari vechi)
    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    // ITP-ul efectuat la aceasta programare (setat cand programarea e finalizata cu ITP)
    @Column(name = "itp_record_id")
    private Long itpRecordId;

    // null pentru programarile create inainte de aceasta coloana
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    private AppUser user;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
