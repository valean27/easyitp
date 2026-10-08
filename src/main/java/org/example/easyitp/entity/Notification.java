package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

// O notificare din aplicatie pentru statie (clopotelul din meniu)
@Entity
@Table(name = "notifications")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    public enum Kind {
        // programare noua facuta de client pe pagina online
        NEW_BOOKING,
        // clientul si-a anulat / mutat programarea din link
        CLIENT_CANCELLED,
        CLIENT_MOVED,
        // un inspector a facut ITP-ul sau a marcat "Nu a venit" din contul lui
        INSPECTOR_ITP,
        INSPECTOR_NO_SHOW
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Kind kind;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 500)
    private String body;

    // unde duce un click (ex. /calendar?date=2026-10-12)
    @Column(length = 300)
    private String link;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "read_at")
    private LocalDateTime readAt;
}
