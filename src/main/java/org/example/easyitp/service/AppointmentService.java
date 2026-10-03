package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.AppointmentDTO;
import org.example.easyitp.entity.Appointment;
import org.example.easyitp.entity.AppointmentStatus;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.repository.AppointmentRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AppointmentService {

    // Durata estimata a unei inspectii; programarile mai apropiate de atat se suprapun
    public static final int SLOT_MINUTES = 30;

    private final AppointmentRepository appointmentRepository;

    public List<AppointmentDTO> getAppointments(Long userId, LocalDateTime start, LocalDateTime end) {
        return appointmentRepository
                .findByUserIdAndAppointmentDateBetweenOrderByAppointmentDateAsc(userId, start, end)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    // Programarile active care se suprapun cu un slot care incepe la "date"
    public List<AppointmentDTO> getConflicts(Long userId, LocalDateTime date, Long excludeId) {
        return appointmentRepository
                .findActiveBetween(userId, date.minusMinutes(SLOT_MINUTES), date.plusMinutes(SLOT_MINUTES))
                .stream()
                .filter(a -> !Objects.equals(a.getId(), excludeId))
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public AppointmentDTO create(AppointmentDTO dto, AppUser user) {
        validate(dto);
        Appointment appt = Appointment.builder()
                .clientName(dto.getClientName().trim())
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
        validate(dto);
        Appointment appt = find(id, userId);
        appt.setClientName(dto.getClientName().trim());
        appt.setPhone(dto.getPhone());
        appt.setLicensePlate(dto.getLicensePlate());
        appt.setAppointmentDate(dto.getAppointmentDate());
        appt.setStatus(dto.getStatus() != null ? dto.getStatus() : appt.getStatus());
        return toDto(appointmentRepository.save(appt));
    }

    // Apelat la salvarea unui ITP facut dintr-o programare
    @Transactional
    public void completeWithItp(Long id, Long userId, Long itpRecordId) {
        Appointment appt = find(id, userId);
        appt.setStatus(AppointmentStatus.COMPLETED);
        appt.setItpRecordId(itpRecordId);
    }

    @Transactional
    public void delete(Long id, Long userId) {
        appointmentRepository.delete(find(id, userId));
    }

    private Appointment find(Long id, Long userId) {
        return appointmentRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Programare inexistenta"));
    }

    private void validate(AppointmentDTO dto) {
        if (dto.getClientName() == null || dto.getClientName().isBlank() || dto.getAppointmentDate() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Numele clientului si data sunt obligatorii");
        }
    }

    private AppointmentDTO toDto(Appointment appt) {
        AppointmentDTO dto = new AppointmentDTO();
        dto.setId(appt.getId());
        dto.setClientName(appt.getClientName());
        dto.setPhone(appt.getPhone());
        dto.setLicensePlate(appt.getLicensePlate());
        dto.setAppointmentDate(appt.getAppointmentDate());
        dto.setStatus(appt.getStatus());
        dto.setItpRecordId(appt.getItpRecordId());
        return dto;
    }
}
