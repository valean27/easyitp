package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

// O intrare in istoricul modificarilor unei statii (vezi AuditService)
@Entity
@Table(name = "audit_events")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditEvent {

    public enum Action { CREATE, UPDATE, DELETE, RESTORE, MERGE, MOVE, IMPORT }

    public enum EntityType { ITP, CLIENT, VEHICLE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Statia (managerul) careia ii apartin datele
    @Column(name = "user_id", nullable = false)
    private Long userId;

    // Contul care a facut modificarea
    private String actor;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Action action;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", nullable = false, length = 20)
    private EntityType entityType;

    @Column(name = "entity_id")
    private Long entityId;

    // Ce s-a atins, pe intelesul omului: "CJ 01 ABC · Ion Pop · ITP 04.10.2026"
    @Column(nullable = false, length = 300)
    private String summary;

    // Campurile schimbate, cate unul pe linie: "Pret: 150 → 200"
    @Column(columnDefinition = "TEXT")
    private String changes;

    // Datele sterse (JSON), pentru "Anuleaza"
    @Column(columnDefinition = "TEXT")
    @ToString.Exclude
    private String snapshot;

    @Column(name = "restored_at")
    private LocalDateTime restoredAt;
}
