package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

// Cine lucreaza pe o linie intr-o zi, peste linia implicita a inspectorilor (inspectorId null = nimeni)
@Entity
@Table(name = "line_shifts", uniqueConstraints = @UniqueConstraint(name = "uk_line_shifts_day_line", columnNames = {"user_id", "shift_date", "line_no"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LineShift {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "shift_date", nullable = false)
    private LocalDate day;

    @Column(name = "line_no", nullable = false)
    private Integer line;

    @Column(name = "inspector_id")
    private Long inspectorId;
}
