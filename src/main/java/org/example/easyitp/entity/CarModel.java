package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "car_model", uniqueConstraints = @UniqueConstraint(columnNames = {"make_id", "name"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CarModel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "make_id", nullable = false)
    @ToString.Exclude
    private CarMake make;
}
