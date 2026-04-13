package org.example.easyitp.dto;

import lombok.Data;
import org.example.easyitp.entity.AppointmentStatus;

import java.time.LocalDateTime;

@Data
public class AppointmentDTO {

    private Long id;
    private String clientName;
    private String phone;
    private String licensePlate;
    private LocalDateTime appointmentDate;
    private AppointmentStatus status;
}
