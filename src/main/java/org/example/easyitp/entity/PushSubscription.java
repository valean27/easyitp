package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

// Un browser / telefon pe care un cont a pornit notificarile push (adresa serviciului de push + cheile browserului)
@Entity
@Table(name = "push_subscriptions", uniqueConstraints = @UniqueConstraint(name = "uk_push_subscriptions_endpoint", columnNames = "endpoint"))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PushSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 1000)
    private String endpoint;

    @Column(nullable = false, length = 200)
    private String p256dh;

    @Column(nullable = false, length = 100)
    private String auth;

    // AppUser.tokenVersion la abonare: dupa schimbarea parolei abonamentul nu mai primeste nimic
    @Column(name = "token_version", nullable = false)
    private Integer tokenVersion;

    @Column(length = 200)
    private String userAgent;

    @Column(nullable = false)
    private LocalDateTime createdAt;
}
