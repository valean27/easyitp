package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;
import org.example.easyitp.service.PlateUtils;

@Entity
@Table(name = "vehicles")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Vehicle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String brand;

    private String model;

    private Integer year;

    private String vin;

    @Column(name = "license_plate", nullable = false)
    private String licensePlate;

    // Numarul fara spatii/cratime, cu majuscule (PlateUtils.normalize); cheia dupa care cautam si grupam vehiculele
    @Column(name = "normalized_plate")
    private String normalizedPlate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", nullable = false)
    @ToString.Exclude
    private Client client;

    @PrePersist
    @PreUpdate
    void normalizePlate() {
        normalizedPlate = PlateUtils.normalize(licensePlate);
    }
}
