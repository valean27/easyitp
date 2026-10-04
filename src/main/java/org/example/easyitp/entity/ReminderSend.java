package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

// Un SMS automat de reamintire: pentru ce ITP, la ce treapta (zile inainte de expirare) si cum a mers
@Entity
@Table(name = "reminder_sends", uniqueConstraints = @UniqueConstraint(columnNames = {"itp_record_id", "stage"}))
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

    @Column(name = "itp_record_id", nullable = false)
    private Long itpRecordId;

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
