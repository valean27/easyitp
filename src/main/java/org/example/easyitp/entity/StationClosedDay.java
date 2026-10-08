package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

// O zi in care statia e inchisa (inventar, renovare, concediu colectiv); sarbatorile legale nu se salveaza aici
@Entity
@Table(name = "station_closed_days", uniqueConstraints = @UniqueConstraint(name = "uk_station_closed_days_day", columnNames = {"user_id", "closed_date"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StationClosedDay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "closed_date", nullable = false)
    private LocalDate date;

    @Column(length = 100)
    private String note;
}
