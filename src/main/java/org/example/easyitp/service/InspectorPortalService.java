package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.AppointmentDTO;
import org.example.easyitp.dto.ItpFormDTO;
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

    // "Finalizat" vine doar din ITP-ul salvat; de mana inspectorul pune doar "Nu a venit" (si inapoi)
    private static final Set<AppointmentStatus> ALLOWED = Set.of(AppointmentStatus.SCHEDULED, AppointmentStatus.NO_SHOW);

    private final InspectorService inspectorService;
    private final AppointmentService appointmentService;
    private final AppointmentRepository appointmentRepository;
    private final AppUserRepository appUserRepository;
    private final ItpRecordRepository itpRecordRepository;
    private final ItpService itpService;
    private final NotificationService notificationService;

    // Datele masinii din ultimul ITP (dupa numar), ca inspectorul sa nu le tasteze din nou
    public record Prefill(String name, String phone, String licensePlate, String brand, String model, Integer year, String vin,
                          Integer validityMonths, Boolean reminderConsent, Integer price) {
    }

    public record Me(String name, String color, String stationName, String stationAddress, String stationPhone,
                     List<String> lineNames, Integer defaultLine, List<DayDTO> schedule,
                     long itpsThisMonth, long failedThisMonth, List<org.example.easyitp.dto.InspectorDTOs.LeaveRange> leaves) {
    }

    // works: lucreaza in ziua aceea (dupa program); line: linia lui (programul, ziua aleasa de manager)
    // leave: CONCEDIU / MEDICAL / LIBER cand lipseste in ziua aceea
    public record Day(LocalDate date, boolean works, Integer line, LocalTime start, LocalTime end, String leave,
                      List<AppointmentDTO> appointments) {
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
                BookingService.lineNames(station), inspector.getDefaultLine(), schedule, itps, failed,
                inspectorService.list(station).stream().filter(i -> i.id().equals(inspector.getId())).findFirst()
                        .map(org.example.easyitp.dto.InspectorDTOs.InspectorDTO::leaves).orElse(List.of()));
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
        String leave = inspectorService.leaveOn(inspector.getId(), date).map(l -> l.getKind().name()).orElse(null);
        return new Day(date, (InspectorService.worksOn(inspector, date) && leave == null) || line != null, line,
                hours != null ? hours.getStart() : null, hours != null ? hours.getEnd() : null, leave, mine);
    }

    @Transactional
    public AppointmentDTO setStatus(AppUser account, Long appointmentId, AppointmentStatus status) {
        Inspector inspector = inspectorService.inspectorOf(account);
        AppUser station = stationOf(inspector);
        if (status == null || !ALLOWED.contains(status)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status nepermis");
        Appointment appt = mine(account, station, appointmentId);
        if (appt.getItpRecordId() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "ITP-ul pentru această programare e deja înregistrat");
        }
        AppointmentDTO mine = day(account, appt.getAppointmentDate().toLocalDate()).appointments().stream()
                .filter(a -> a.getId().equals(appointmentId)).findFirst().orElseThrow();
        appt.setStatus(status);
        appointmentRepository.save(appt);
        if (status == AppointmentStatus.NO_SHOW) {
            notificationService.add(station.getId(), org.example.easyitp.entity.Notification.Kind.INSPECTOR_NO_SHOW,
                    appt.getClientName() + " nu a venit la programare",
                    inspector.getName() + " · " + AppointmentMailService.when(appt.getAppointmentDate()),
                    "/calendar?date=" + appt.getAppointmentDate().toLocalDate());
        }
        mine.setStatus(status);
        return mine;
    }

    // Datele de pornire ale ITP-ului: programarea + masina din ultimul ITP cu acelasi numar
    @Transactional(readOnly = true)
    public Prefill prefill(AppUser account, Long appointmentId) {
        Inspector inspector = inspectorService.inspectorOf(account);
        AppUser station = stationOf(inspector);
        Appointment appt = mine(account, station, appointmentId);
        var last = appt.getLicensePlate() == null ? java.util.Optional.<org.example.easyitp.dto.DashboardDTO>empty()
                : itpService.lookupByPlate(appt.getLicensePlate(), station.getId());
        return new Prefill(appt.getClientName(), appt.getPhone(), appt.getLicensePlate(),
                last.map(org.example.easyitp.dto.DashboardDTO::getMarca).orElse(null),
                last.map(org.example.easyitp.dto.DashboardDTO::getModel).orElse(null),
                last.map(org.example.easyitp.dto.DashboardDTO::getYear).orElse(null),
                last.map(org.example.easyitp.dto.DashboardDTO::getVin).orElse(null),
                last.map(org.example.easyitp.dto.DashboardDTO::getValabilitateLuni).orElse(null),
                appt.getReminderConsent(),
                InspectionPrices.priceFor(station, appt.getVehicleCategory()));
    }

    // ITP-ul facut de inspector la o programare a lui: se salveaza pe statie, cu numele lui, iar programarea devine
    // "Finalizat" (ca la "Incepe ITP" din contul statiei)
    @Transactional
    public AppointmentDTO startItp(AppUser account, Long appointmentId, ItpFormDTO form) {
        Inspector inspector = inspectorService.inspectorOf(account);
        AppUser station = stationOf(inspector);
        Appointment appt = mine(account, station, appointmentId);
        if (appt.getStatus() == AppointmentStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Programarea este anulată");
        }
        if (appt.getItpRecordId() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "ITP-ul pentru această programare e deja înregistrat");
        }
        form.setInspector(inspector.getName());
        form.setAppointmentId(appointmentId);
        // termenele RCA / rovinieta raman cum le-a pus statia
        form.setDeadlines(null);
        itpService.createItpEntry(form, station, account.getEmail());
        notificationService.add(station.getId(), org.example.easyitp.entity.Notification.Kind.INSPECTOR_ITP,
                inspector.getName() + " a făcut ITP-ul: " + appt.getClientName(),
                (form.getLicensePlate() != null ? form.getLicensePlate().trim().toUpperCase() + " · " : "")
                        + (form.getStatus() == null || form.getStatus() == org.example.easyitp.entity.ItpStatus.PASSED ? "Admis"
                        : form.getStatus() == org.example.easyitp.entity.ItpStatus.FAILED ? "Respins" : "Reverificare"),
                "/calendar?date=" + appt.getAppointmentDate().toLocalDate());
        return day(account, appt.getAppointmentDate().toLocalDate()).appointments().stream()
                .filter(a -> a.getId().equals(appointmentId)).findFirst().orElseThrow();
    }

    // O programare a lui: aleasa anume pentru el sau de pe linia pe care lucreaza in ziua aceea (altfel 404)
    private Appointment mine(AppUser account, AppUser station, Long appointmentId) {
        Appointment appt = appointmentRepository.findByIdAndUserId(appointmentId, station.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Programare inexistenta"));
        boolean ok = day(account, appt.getAppointmentDate().toLocalDate()).appointments().stream()
                .anyMatch(a -> a.getId().equals(appointmentId));
        if (!ok) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Programare inexistenta");
        return appt;
    }

    private AppUser stationOf(Inspector inspector) {
        AppUser station = appUserRepository.findById(inspector.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Stația nu mai există"));
        if (!station.isEnabled()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Contul stației este închis");
        return station;
    }
}
