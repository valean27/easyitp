package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

// O factura emisa in Oblio: pentru centralizatorul lunar al unei flote sau pentru un ITP (persoana fizica)
@Entity
@Table(name = "invoices", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"fleet_id", "period"}),
        @UniqueConstraint(columnNames = {"itp_record_id"})})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "fleet_id")
    private Long fleetId;

    // "2026-10" pentru centralizator
    @Column(length = 7)
    private String period;

    @Column(name = "itp_record_id")
    private Long itpRecordId;

    @Column(name = "client_name", length = 200)
    private String clientName;

    @Column(name = "series_name", nullable = false, length = 30)
    private String seriesName;

    @Column(nullable = false, length = 30)
    private String number;

    @Column(length = 500)
    private String link;

    @Column(nullable = false)
    private Double total;

    // rezultatul trimiterii in SPV (null = netrimisa)
    @Column(name = "einvoice_status", length = 200)
    private String einvoiceStatus;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
