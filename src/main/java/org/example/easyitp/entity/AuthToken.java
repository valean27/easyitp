package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

// Link trimis pe email (confirmarea adresei, resetarea parolei); in baza de date doar hash-ul tokenului
@Entity
@Table(name = "auth_tokens")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthToken {

    public enum Purpose {
        VERIFY_EMAIL,
        RESET_PASSWORD
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Purpose purpose;

    @Column(nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    private LocalDateTime usedAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;
}
