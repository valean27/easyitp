package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

// Logo-ul unei statii: PNG de cel mult 400 px, refacut de server din ce a incarcat managerul
@Entity
@Table(name = "station_logos")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StationLogo {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @JdbcTypeCode(SqlTypes.VARBINARY)
    @Column(nullable = false, length = 1_000_000)
    @ToString.Exclude
    private byte[] image;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
