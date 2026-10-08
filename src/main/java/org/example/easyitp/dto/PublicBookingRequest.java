package org.example.easyitp.dto;

import lombok.Data;
import org.example.easyitp.entity.VehicleCategory;

import java.time.LocalDateTime;

@Data
public class PublicBookingRequest {
    private String clientName;
    private String phone;
    private String licensePlate;
    // optional: confirmarea pe email, cu link de calendar
    private String email;
    // Clientul a bifat ca vrea remindere ITP de la statie
    private Boolean reminderConsent;
    private LocalDateTime appointmentDate;
    private VehicleCategory vehicleCategory;
    // Camp-capcana: invizibil pentru oameni, completat doar de boti
    private String website;
}
