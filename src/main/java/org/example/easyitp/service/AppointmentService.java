package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.AppointmentDTO;
import org.example.easyitp.entity.Appointment;
import org.example.easyitp.entity.AppointmentStatus;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.repository.AppointmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;

    public List<AppointmentDTO> getAppointments(Long userId, LocalDateTime start, LocalDateTime end) {
        return appointmentRepository
                .findByUserIdAndAppointmentDateBetweenOrderByAppointmentDateAsc(userId, start, end)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public AppointmentDTO create(AppointmentDTO dto, AppUser user) {
        Appointment appt = Appointment.builder()
                .clientName(dto.getClientName())
                .phone(dto.getPhone())
                .licensePlate(dto.getLicensePlate())
                .appointmentDate(dto.getAppointmentDate())
                .status(dto.getStatus() != null ? dto.getStatus() : AppointmentStatus.SCHEDULED)
                .user(user)
                .build();
        return toDto(appointmentRepository.save(appt));
    }

    @Transactional
    public AppointmentDTO update(Long id, AppointmentDTO dto, Long userId) {
        Appointment appt = appointmentRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new RuntimeException("Appointment not found or access denied"));
        appt.setClientName(dto.getClientName());
        appt.setPhone(dto.getPhone());
        appt.setLicensePlate(dto.getLicensePlate());
        appt.setAppointmentDate(dto.getAppointmentDate());
        appt.setStatus(dto.getStatus() != null ? dto.getStatus() : appt.getStatus());
        return toDto(appointmentRepository.save(appt));
    }

    @Transactional
    public void delete(Long id, Long userId) {
        Appointment appt = appointmentRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new RuntimeException("Appointment not found or access denied"));
        appointmentRepository.delete(appt);
    }

    private AppointmentDTO toDto(Appointment appt) {
        AppointmentDTO dto = new AppointmentDTO();
        dto.setId(appt.getId());
        dto.setClientName(appt.getClientName());
        dto.setPhone(appt.getPhone());
        dto.setLicensePlate(appt.getLicensePlate());
        dto.setAppointmentDate(appt.getAppointmentDate());
        dto.setStatus(appt.getStatus());
        return dto;
    }
}
