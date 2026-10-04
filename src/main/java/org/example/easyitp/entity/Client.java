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

    @PrePersist
    @PreUpdate
    void computePhoneKey() {
        phoneKey = ClientKeys.phoneKey(phone);
    }
}
