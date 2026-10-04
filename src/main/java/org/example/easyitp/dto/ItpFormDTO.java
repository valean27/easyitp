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
    private String inspector;
    // Bifa "clientul e de acord cu remindere"; null = nu schimba nimic (ex. clienti vechi, import)
    private Boolean reminderConsent;
    // Optional: programarea din care s-a facut ITP-ul (devine "Finalizat")
    private Long appointmentId;
}
