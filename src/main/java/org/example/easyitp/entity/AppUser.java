package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

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
