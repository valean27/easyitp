package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "car_make")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CarMake {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;
}
