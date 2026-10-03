package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "app_users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    // Date statie ITP (un manager = o statie)
    private String stationName;
    private String address;
    private String phone;

    // Mesajul de reamintire ITP cu placeholdere ({nume}, {numar}, ...); null = mesajul implicit
    @Column(columnDefinition = "TEXT")
    private String reminderTemplate;

    // Programare online (pagina publica /programare/{bookingSlug}); null = valorile implicite din BookingService
    private Boolean bookingEnabled;

    @Column(unique = true, length = 60)
    private String bookingSlug;

    private LocalTime bookingOpen;
    private LocalTime bookingClose;

    // Zilele lucratoare ca numere ISO separate prin virgula (1 = luni ... 7 = duminica)
    @Column(length = 20)
    private String bookingDays;

    // Cate masini pot fi programate in acelasi interval (numarul de linii ITP)
    private Integer bookingCapacity;

    private LocalDateTime createdAt;
    private LocalDateTime lastLoginAt;

    // null pentru conturile vechi = activ
    private Boolean active;

    public boolean isEnabled() {
        return !Boolean.FALSE.equals(active);
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (active == null) active = true;
    }
}
