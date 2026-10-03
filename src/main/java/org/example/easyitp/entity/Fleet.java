package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

// Firma cu flota de masini (curierat, scoala de soferi etc.), client B2B al unei statii.
// Masinile ei sunt numerele de inmatriculare alocate de manager; ITP-urile lor la statie apar in portalul firmei.
@Entity
@Table(name = "fleets")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Fleet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    // Codul fiscal, pentru centralizatorul lunar
    @Column(length = 20)
    private String cui;

    @Column(length = 120)
    private String contactName;

    @Column(length = 40)
    private String contactPhone;

    // Numerele asa cum le-a scris managerul (cu majuscule); se compara normalizate (PlateUtils)
    // Lista de flote incarca numerele pentru mai multe firme dintr-o singura interogare
    @org.hibernate.annotations.BatchSize(size = 50)
    @ElementCollection
    @CollectionTable(name = "fleet_plates", joinColumns = @JoinColumn(name = "fleet_id"))
    @Column(name = "plate", length = 20)
    @Builder.Default
    private List<String> plates = new ArrayList<>();

    // Statia careia ii apartine firma
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private AppUser station;

    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
