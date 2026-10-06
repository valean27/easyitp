package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

// O cerere de retragere din contract, trimisa din pagina publica /retragere
@Entity
@Table(name = "withdrawals")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Withdrawal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, length = 150)
    private String email;

    // Cum identifica clientul contractul (emailul contului, comanda, factura)
    @Column(nullable = false, length = 300)
    private String contract;

    @Column(length = 1000)
    private String message;

    // Contul de statie cu acelasi email, daca exista
    private Long userId;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private Boolean handled;
}
