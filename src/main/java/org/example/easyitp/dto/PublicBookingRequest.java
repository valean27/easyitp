package org.example.easyitp.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class PublicBookingRequest {
    private String clientName;
    private String phone;
    private String licensePlate;
    private LocalDateTime appointmentDate;
    // Camp-capcana: invizibil pentru oameni, completat doar de boti
    private String website;
}
