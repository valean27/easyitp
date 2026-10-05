package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

// O scadenta a masinii (RCA, rovinieta, tahograf); cel mult una pe tip
@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VehicleDeadline {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DeadlineKind kind;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    // Statia a contactat clientul pentru aceasta scadenta
    @Column(name = "contacted_at")
    private LocalDateTime contactedAt;
}
