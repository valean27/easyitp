package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

// Un inspector al statiei (contul propriu, optional, e un AppUser cu rolul INSPECTOR): apare in formularul ITP, pe programari, pe linii si in dashboard
@Entity
@Table(name = "inspectors")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Inspector {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(length = 20)
    private String phone;

    // culoarea din calendar si din grafice (cheie din InspectorService.COLORS)
    @Column(length = 20)
    private String color;

    // inactiv = nu mai apare la alegere (a plecat, e in concediu lung), dar ramane in istoric si rapoarte
    @Column(nullable = false)
    private boolean active;

    // linia pe care lucreaza de obicei (null = niciuna anume)
    @Column(name = "default_line")
    private Integer defaultLine;

    @Column(nullable = false)
    private int position;

    // Programul saptamanal; gol = fara program fix (e pe linia lui in fiecare zi)
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "inspector_days", joinColumns = @JoinColumn(name = "inspector_id"))
    @OrderBy("weekday")
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<InspectorDay> schedule = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
