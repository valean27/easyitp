package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

// Un SMS automat de reamintire: pentru ce ITP (sau ce alta scadenta a masinii), la ce treapta (zile inainte de
// expirare) si cum a mers
@Entity
@Table(name = "reminder_sends", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"itp_record_id", "stage"}),
        @UniqueConstraint(columnNames = {"vehicle_id", "kind", "due_date"})})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReminderSend {

    public enum Status { SENT, FAILED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    // ITP-ul; gol pentru RCA / rovinieta / tahograf, care au masina, tipul si data scadentei
    @Column(name = "itp_record_id")
    private Long itpRecordId;

    @Column(name = "vehicle_id")
    private Long vehicleId;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private DeadlineKind kind;

    @Column(name = "due_date")
    private LocalDate dueDate;

    // Cu cate zile inainte de expirare (30, 7...)
    @Column(nullable = false)
    private Integer stage;

    @Column(length = 30)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private SmsProvider provider;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status;

    @Column(nullable = false)
    private Integer attempts;

    @Column(name = "message_id", length = 100)
    private String messageId;

    @Column(length = 300)
    private String error;

    @Column(name = "sent_at", nullable = false)
    private LocalDateTime sentAt;
}
