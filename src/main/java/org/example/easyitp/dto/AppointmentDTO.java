package org.example.easyitp.dto;

import lombok.Data;
import org.example.easyitp.entity.AppointmentSource;
import org.example.easyitp.entity.AppointmentStatus;
import org.example.easyitp.entity.VehicleCategory;

import java.time.LocalDateTime;

@Data
public class AppointmentDTO {

    private Long id;
    private String clientName;
    private String phone;
    private String licensePlate;
    private LocalDateTime appointmentDate;
    private AppointmentStatus status;
    private Long itpRecordId;
    private AppointmentSource source;
    private VehicleCategory vehicleCategory;
    private Integer durationMinutes;
    // Linia ITP (1..numarul de linii); null la salvare = prima linie libera; null la citire = peste capacitate
    private Integer line;
    private Boolean reminderConsent;
    // Ce a facut clientul din link-ul din SMS: CANCELLED / RESCHEDULED (null = nimic)
    private String clientAction;
    private java.time.LocalDateTime clientActionAt;
}
