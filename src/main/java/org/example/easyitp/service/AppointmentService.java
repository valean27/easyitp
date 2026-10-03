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

    private final AppointmentRepository appointmentRepository;

    public List<AppointmentDTO> getAppointments(Long userId, LocalDateTime start, LocalDateTime end) {
        return appointmentRepository
                .findByUserIdAndAppointmentDateBetweenOrderByAppointmentDateAsc(userId, start, end)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    // Programarile active care se suprapun cu intervalul [date, date + minutes)
    public List<AppointmentDTO> getConflicts(Long userId, LocalDateTime date, int minutes, Long excludeId) {
        LocalDateTime end = date.plusMinutes(minutes);
        return appointmentRepository
                .findActiveBetween(userId, date.minusMinutes(InspectionDurations.MAX_MINUTES), end)
                .stream()
                .filter(a -> !Objects.equals(a.getId(), excludeId))
                .filter(a -> a.getAppointmentDate().plusMinutes(InspectionDurations.minutesOf(a)).isAfter(date))
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
                .vehicleCategory(dto.getVehicleCategory())
                .durationMinutes(duration(dto, user))
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
        // Clientii vechi (fara tip) trimit null: pastram ce era salvat
        if (dto.getVehicleCategory() != null || dto.getDurationMinutes() != null) {
            appt.setVehicleCategory(dto.getVehicleCategory());
            appt.setDurationMinutes(duration(dto, appt.getUser()));
        }
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
        Integer minutes = dto.getDurationMinutes();
        if (minutes != null && (minutes < InspectionDurations.MIN_MINUTES || minutes > InspectionDurations.MAX_MINUTES)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Durata trebuie sa fie intre "
                    + InspectionDurations.MIN_MINUTES + " si " + InspectionDurations.MAX_MINUTES + " de minute");
        }
    }

    // Durata aleasa de manager sau, daca lipseste, cea a statiei pentru tipul vehiculului
    private static int duration(AppointmentDTO dto, AppUser station) {
        return dto.getDurationMinutes() != null
                ? dto.getDurationMinutes()
                : InspectionDurations.minutesFor(station, dto.getVehicleCategory());
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
        dto.setSource(appt.getSource());
        dto.setVehicleCategory(appt.getVehicleCategory());
        dto.setDurationMinutes(InspectionDurations.minutesOf(appt));
        return dto;
    }
}
