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

    // Emailul optional al clientului (confirmarea cu link de calendar)
    @Column(length = 150)
    private String email;

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

    // Linia ITP (1..numarul de linii al statiei); null = programare veche, linia se alege la afisare
    @Column(name = "line_no")
    private Integer line;

    // Inspectorul ales anume (null = cel care lucreaza pe linia programarii in ziua ei)
    @Column(name = "inspector_id")
    private Long inspectorId;

    // Bifa de acord pentru remindere din programarea online; trece la client cand se face ITP-ul
    @Column(name = "reminder_consent")
    private Boolean reminderConsent;

    // ITP-ul efectuat la aceasta programare (setat cand programarea e finalizata cu ITP)
    @Column(name = "itp_record_id")
    private Long itpRecordId;

    // null pentru programarile create inainte de aceasta coloana
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    // Link-ul clientului pentru anulare / mutare (/p/{manageToken}), trimis in SMS
    @Column(name = "manage_token", length = 40, unique = true)
    private String manageToken;

    // SMS-ul de confirmare si reminderul cu o zi inainte (null = netrimise)
    @Column(name = "confirmation_sent_at")
    private LocalDateTime confirmationSentAt;
    @Column(name = "reminder_sent_at")
    private LocalDateTime reminderSentAt;

    // Ce a facut clientul din link: CANCELLED sau RESCHEDULED (vazut de manager in calendar)
    @Column(name = "client_action", length = 20)
    private String clientAction;
    @Column(name = "client_action_at")
    private LocalDateTime clientActionAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    private AppUser user;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (manageToken == null) manageToken = org.example.easyitp.service.ClientKeys.newToken().substring(0, 16);
    }
}
