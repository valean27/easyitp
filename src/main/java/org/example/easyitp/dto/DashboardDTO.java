package org.example.easyitp.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.example.easyitp.entity.ItpStatus;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DashboardDTO {

    private Long id;
    private String numeSofer;
    private String contact;
    private String marca;
    private String model;
    private Integer year;
    private String vin;
    private String numarInmatriculare;
    private LocalDate dataItp;
    private Integer valabilitateLuni;
    private LocalDate dataUrmatorItp;
    private long zileRamase;
    private ItpStatus status;
    private Integer mileage;
    private Double price;
    private String observations;
}
