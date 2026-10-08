package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

// O zi in care inspectorul lipseste; o perioada de concediu = cate un rand pe zi
@Entity
@Table(name = "inspector_leaves", uniqueConstraints = @UniqueConstraint(name = "uk_inspector_leaves_day", columnNames = {"inspector_id", "leave_date"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InspectorLeave {

    public enum Kind {
        CONCEDIU, MEDICAL, LIBER
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "inspector_id", nullable = false)
    private Long inspectorId;

    @Column(name = "leave_date", nullable = false)
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Kind kind;

    @Column(length = 200)
    private String note;
}
