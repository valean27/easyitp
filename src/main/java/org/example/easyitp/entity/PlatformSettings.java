package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

// Setarile platformei (un singur rand, id = 1), editate de admin: facturarea abonamentelor prin FGO
@Entity
@Table(name = "platform_settings")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlatformSettings {

    public static final long ID = 1L;

    @Id
    private Long id;

    // CUI-ul firmei care emite facturile (CodUnic in FGO)
    @Column(name = "fgo_cui", length = 20)
    private String fgoCui;

    // Cheia privata API, criptata (SecretBox); null = FGO nesetat
    @Column(name = "fgo_key", length = 500)
    @ToString.Exclude
    private String fgoKey;

    @Column(name = "fgo_series", length = 20)
    private String fgoSeries;

    // Mediul de test FGO (api-testuat.fgo.ro); null / false = productie
    @Column(name = "fgo_test")
    private Boolean fgoTest;

    // Dupa emitere se inregistreaza si incasarea (doar FGO Premium / Enterprise)
    @Column(name = "fgo_mark_paid")
    private Boolean fgoMarkPaid;

    // Tipul incasarii din nomenclatorul FGO (ex. "Card")
    @Column(name = "fgo_payment_type", length = 50)
    private String fgoPaymentType;

    private LocalDateTime updatedAt;
}
