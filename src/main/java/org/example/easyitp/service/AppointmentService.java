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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final BookingService bookingService;
    private final InspectorService inspectorService;

    // Programarile din interval; cele vechi, fara linie, primesc linia pe care incap in ziua lor (doar la afisare)
    public List<AppointmentDTO> getAppointments(AppUser station, LocalDateTime start, LocalDateTime end) {
        List<Appointment> appts = appointmentRepository
                .findByUserIdAndAppointmentDateBetweenOrderByAppointmentDateAsc(station.getId(), start, end);
        Map<Long, Integer> lines = new HashMap<>();
        appts.stream()
                .filter(a -> a.getStatus() != AppointmentStatus.CANCELLED)
                .collect(Collectors.groupingBy(a -> a.getAppointmentDate().toLocalDate()))
                .values()
                .forEach(day -> lines.putAll(LinePlanner.assign(day.stream().map(BookingService::booked).toList(),
                        BookingService.lines(station))));
        // doar zilele cu programari (intervalul cerut poate fi oricat de lung)
        Map<java.time.LocalDate, Map<Integer, Long>> onLines = appts.isEmpty() ? Map.of()
                : inspectorService.lineInspectors(station, appts.get(0).getAppointmentDate().toLocalDate(),
                        appts.get(appts.size() - 1).getAppointmentDate().toLocalDate());
        return appts.stream()
                .map(a -> {
                    AppointmentDTO dto = toDto(a);
                    if (a.getLine() == null) dto.setLine(lines.get(a.getId()));
                    if (dto.getLine() != null) {
                        dto.setLineInspectorId(onLines.getOrDefault(a.getAppointmentDate().toLocalDate(), Map.of()).get(dto.getLine()));
                    }
                    return dto;
                })
                .collect(Collectors.toList());
    }

    // Programarile active care se suprapun cu intervalul [date, date + minutes), cu linia lor
    public List<AppointmentDTO> getConflicts(AppUser station, LocalDateTime date, int minutes, Long excludeId) {
        LocalDateTime end = date.plusMinutes(minutes);
        List<LinePlanner.Booked> day = bookingService.dayBooked(station, date.toLocalDate(), excludeId);
        Map<Long, Integer> lines = LinePlanner.assign(day, BookingService.lines(station));
        return appointmentRepository
                .findActiveBetween(station.getId(), date.minusMinutes(InspectionDurations.MAX_MINUTES), end)
                .stream()
                .filter(a -> !Objects.equals(a.getId(), excludeId))
                .filter(a -> a.getAppointmentDate().plusMinutes(InspectionDurations.minutesOf(a)).isAfter(date))
                .map(a -> {
                    AppointmentDTO dto = toDto(a);
                    if (lines.containsKey(a.getId())) dto.setLine(lines.get(a.getId()));
                    return dto;
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public AppointmentDTO create(AppointmentDTO dto, AppUser user) {
        validate(dto);
        validateLine(dto.getLine(), user);
        inspectorService.requireOwn(user, dto.getInspectorId());
        Appointment appt = Appointment.builder()
                .clientName(dto.getClientName().trim())
                .phone(PhoneNumbers.optionalValid(dto.getPhone()))
                .licensePlate(dto.getLicensePlate())
                .appointmentDate(dto.getAppointmentDate())
                .status(dto.getStatus() != null ? dto.getStatus() : AppointmentStatus.SCHEDULED)
                .vehicleCategory(dto.getVehicleCategory())
                .durationMinutes(duration(dto, user))
                .inspectorId(dto.getInspectorId())
                .user(user)
                .build();
        // Linia aleasa de manager (chiar daca e ocupata, ca pana acum); fara linie = prima libera
        appt.setLine(dto.getLine() != null ? dto.getLine()
                : bookingService.pickLine(user, appt.getAppointmentDate(), InspectionDurations.minutesOf(appt), null, null));
        return toDto(appointmentRepository.save(appt));
    }

    @Transactional
    public AppointmentDTO update(Long id, AppointmentDTO dto, AppUser station) {
        validate(dto);
        validateLine(dto.getLine(), station);
        inspectorService.requireOwn(station, dto.getInspectorId());
        Appointment appt = find(id, station.getId());
        appt.setInspectorId(dto.getInspectorId());
        appt.setClientName(dto.getClientName().trim());
        // un numar vechi, scris gresit inainte de verificare, nu blocheaza mutarea programarii: verificam doar unul schimbat
        String phone = dto.getPhone() == null ? null : dto.getPhone().trim();
        if (!Objects.equals(phone, appt.getPhone() == null ? null : appt.getPhone().trim())) {
            appt.setPhone(PhoneNumbers.optionalValid(phone));
        }
        appt.setLicensePlate(dto.getLicensePlate());
        appt.setAppointmentDate(dto.getAppointmentDate());
        appt.setStatus(dto.getStatus() != null ? dto.getStatus() : appt.getStatus());
        // Clientii vechi (fara tip) trimit null: pastram ce era salvat
        if (dto.getVehicleCategory() != null || dto.getDurationMinutes() != null) {
            appt.setVehicleCategory(dto.getVehicleCategory());
            appt.setDurationMinutes(duration(dto, appt.getUser()));
        }
        // Fara linie (ex. mutata prin drag & drop in saptamana): ramane pe linia ei daca e libera, altfel prima libera
        if (dto.getLine() != null) {
            appt.setLine(dto.getLine());
        } else {
            Integer free = bookingService.pickLine(station, appt.getAppointmentDate(), InspectionDurations.minutesOf(appt),
                    appt.getId(), appt.getLine());
            if (free != null) appt.setLine(free);
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

    private static void validateLine(Integer line, AppUser station) {
        if (line != null && (line < 1 || line > BookingService.lines(station))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Linia trebuie sa fie intre 1 si " + BookingService.lines(station));
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
        dto.setLine(appt.getLine());
        dto.setInspectorId(appt.getInspectorId());
        dto.setReminderConsent(appt.getReminderConsent());
        dto.setClientAction(appt.getClientAction());
        dto.setClientActionAt(appt.getClientActionAt());
        return dto;
    }
}
