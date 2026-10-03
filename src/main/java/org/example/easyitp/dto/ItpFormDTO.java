package org.example.easyitp.dto;

import lombok.Data;
import org.example.easyitp.entity.ItpStatus;

import java.time.LocalDate;

@Data
public class ItpFormDTO {

    private String name;
    private String phone;
    private String brand;
    private String model;
    private Integer year;
    private String vin;
    private String licensePlate;
    private LocalDate testDate;
    private Integer validityMonths;
    private ItpStatus status;
    private Integer mileage;
    private Double price;
    private String observations;
    // Optional: programarea din care s-a facut ITP-ul (devine "Finalizat")
    private Long appointmentId;
}
