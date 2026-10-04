package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;
import org.example.easyitp.service.ClientKeys;

@Entity
@Table(name = "clients")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Client {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String phone;

    // Ultimele 9 cifre ale telefonului (ClientKeys.phoneKey); dupa ele recunoastem acelasi client
    @Column(name = "phone_key", length = 20)
    private String phoneKey;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @ToString.Exclude
    private AppUser user;

    // Acordul pentru remindere (GDPR); null = necunoscut
    @Enumerated(EnumType.STRING)
    @Column(name = "reminder_consent", length = 20)
    private ReminderConsent reminderConsent;

    @Column(name = "consent_at")
    private java.time.LocalDateTime consentAt;

    // De unde vine acordul/refuzul: "Formular ITP", "Programare online", "Link STOP", "Stație"
    @Column(name = "consent_source", length = 40)
    private String consentSource;

    // Link-ul personal de dezabonare (/stop/{token}), trimis in mesaje
    @Column(name = "opt_out_token", length = 40, unique = true)
    private String optOutToken;

    public boolean declinesMessages() {
        return reminderConsent == ReminderConsent.DECLINED;
    }

    @PrePersist
    @PreUpdate
    void computePhoneKey() {
        phoneKey = ClientKeys.phoneKey(phone);
        if (optOutToken == null) optOutToken = ClientKeys.newToken();
    }
}
