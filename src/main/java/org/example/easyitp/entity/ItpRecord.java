package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "itp_records")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ItpRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicle_id", nullable = false)
    @ToString.Exclude
    private Vehicle vehicle;

    @Column(name = "test_date", nullable = false)
    private LocalDate testDate;

    @Column(name = "validity_months", nullable = false)
    private Integer validityMonths;

    @Column(name = "next_itp_date", nullable = false)
    private LocalDate nextItpDate;
}
