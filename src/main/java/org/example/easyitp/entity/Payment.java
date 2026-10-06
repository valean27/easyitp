package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

// O plata a abonamentului prin Netopia: pachetul, SMS-urile incluse, cate luni, suma cu TVA si factura emisa dupa plata
@Entity
@Table(name = "payments")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    // Id-ul comenzii trimis la Netopia (si in linkul de intoarcere)
    @Column(nullable = false, unique = true, length = 40)
    private String orderId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Plan plan;

    @Column(nullable = false)
    private Integer smsPlan;

    @Column(nullable = false)
    private Integer months;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentStatus status;

    @Column(length = 80)
    private String ntpId;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime paidAt;

    // Pana cand e platit pachetul dupa aceasta plata
    private LocalDate planUntil;

    @Column(length = 60)
    private String invoiceNumber;

    @Column(length = 500)
    private String invoiceLink;

    @Column(length = 300)
    private String invoiceError;
}
