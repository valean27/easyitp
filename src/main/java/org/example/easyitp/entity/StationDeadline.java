package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

// Un termen al statiei: autorizatia RAR, verificarea metrologica a unui echipament, atestatul unui inspector
@Entity
@Table(name = "station_deadlines")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StationDeadline {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private StationDeadlineKind kind;

    // ce anume: echipamentul ("Banc de frânare"), inspectorul, numărul autorizației
    @Column(length = 120)
    private String title;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Column(length = 300)
    private String notes;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
