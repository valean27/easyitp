package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.AppointmentDTO;
import org.example.easyitp.dto.InspectorDTOs.DayDTO;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Appointment;
import org.example.easyitp.entity.AppointmentStatus;
import org.example.easyitp.entity.Inspector;
import org.example.easyitp.entity.InspectorDay;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.entity.ItpStatus;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.AppointmentRepository;
import org.example.easyitp.repository.ItpRecordRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

// Contul propriu al inspectorului: ziua lui (linia, orele, programarile lui), programul saptamanal si cateva cifre.
// Poate marca o programare a lui ca finalizata sau neprezentata; nu vede restul statiei.
@Service
@RequiredArgsConstructor
public class InspectorPortalService {

    private static final Set<AppointmentStatus> ALLOWED = Set.of(AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW);

    private final InspectorService inspectorService;
    private final AppointmentService appointmentService;
    private final AppointmentRepository appointmentRepository;
    private final AppUserRepository appUserRepository;
    private final ItpRecordRepository itpRecordRepository;

    public record Me(String name, String color, String stationName, String stationAddress, String stationPhone,
                     List<String> lineNames, Integer defaultLine, List<DayDTO> schedule,
                     long itpsThisMonth, long failedThisMonth) {
    }

    // works: lucreaza in ziua aceea (dupa program); line: linia lui (programul, ziua aleasa de manager)
    public record Day(LocalDate date, boolean works, Integer line, LocalTime start, LocalTime end, List<AppointmentDTO> appointments) {
    }

    public record StatusRequest(AppointmentStatus status) {
    }

    @Transactional(readOnly = true)
    public Me me(AppUser account) {
        Inspector inspector = inspectorService.inspectorOf(account);
        AppUser station = stationOf(inspector);
        LocalDate today = LocalDate.now();
        long itps = 0, failed = 0;
        for (ItpRecord r : itpRecordRepository.findByUserIdAndTestDateBetween(station.getId(), today.withDayOfMonth(1), today)) {
            if (r.getInspector() == null || !r.getInspector().trim().equalsIgnoreCase(inspector.getName())) continue;
            itps++;
            if (r.getStatus() == ItpStatus.FAILED) failed++;
        }
        List<DayDTO> schedule = inspector.getSchedule().stream()
                .map(d -> new DayDTO(d.getWeekday(), d.getLine(), d.getStart(), d.getEnd())).toList();
        return new Me(inspector.getName(), inspector.getColor(), station.getStationName(), station.getAddress(), station.getPhone(),
                BookingService.lineNames(station), inspector.getDefaultLine(), schedule, itps, failed);
    }

    @Transactional(readOnly = true)
    public Day day(AppUser account, LocalDate date) {
        Inspector inspector = inspectorService.inspectorOf(account);
        AppUser station = stationOf(inspector);
        Map<Integer, Long> lines = inspectorService.lineInspectors(station, date, date).getOrDefault(date, Map.of());
        Integer line = lines.entrySet().stream().filter(e -> Objects.equals(e.getValue(), inspector.getId()))
                .map(Map.Entry::getKey).sorted().findFirst().orElse(null);
        InspectorDay hours = InspectorService.dayOf(inspector, date).orElse(null);
        List<AppointmentDTO> mine = appointmentService.getAppointments(station, date.atStartOfDay(), date.atTime(23, 59, 59)).stream()
                .filter(a -> a.getStatus() != AppointmentStatus.CANCELLED)
                .filter(a -> Objects.equals(a.getInspectorId() != null ? a.getInspectorId() : a.getLineInspectorId(), inspector.getId()))
                .toList();
        return new Day(date, InspectorService.worksOn(inspector, date) || line != null, line,
                hours != null ? hours.getStart() : null, hours != null ? hours.getEnd() : null, mine);
    }

    @Transactional
    public AppointmentDTO setStatus(AppUser account, Long appointmentId, AppointmentStatus status) {
        Inspector inspector = inspectorService.inspectorOf(account);
        AppUser station = stationOf(inspector);
        if (status == null || !ALLOWED.contains(status)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status nepermis");
        Appointment appt = appointmentRepository.findByIdAndUserId(appointmentId, station.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Programare inexistenta"));
        LocalDate date = appt.getAppointmentDate().toLocalDate();
        // doar programarile lui: alese anume pentru el sau de pe linia pe care lucreaza in ziua aceea
        AppointmentDTO mine = day(account, date).appointments().stream()
                .filter(a -> a.getId().equals(appointmentId)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Programare inexistenta"));
        appt.setStatus(status);
        appointmentRepository.save(appt);
        mine.setStatus(status);
        return mine;
    }

    private AppUser stationOf(Inspector inspector) {
        AppUser station = appUserRepository.findById(inspector.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Stația nu mai există"));
        if (!station.isEnabled()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Contul stației este închis");
        return station;
    }
}
