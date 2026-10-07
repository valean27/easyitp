package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.InspectorDTOs.Dashboard;
import org.example.easyitp.dto.InspectorDTOs.Day;
import org.example.easyitp.dto.InspectorDTOs.DayCount;
import org.example.easyitp.dto.InspectorDTOs.InspectorDTO;
import org.example.easyitp.dto.InspectorDTOs.InspectorStats;
import org.example.easyitp.dto.InspectorDTOs.Totals;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Appointment;
import org.example.easyitp.entity.AppointmentStatus;
import org.example.easyitp.entity.Inspector;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.entity.ItpStatus;
import org.example.easyitp.repository.AppointmentRepository;
import org.example.easyitp.repository.ItpRecordRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

// Dashboard-ul inspectorilor (Pro, cu rapoartele pentru patron): ITP-uri, incasari, respingeri, zile lucrate,
// programari (inclusiv neprezentari) si cine e azi pe ce linie
@Service
@RequiredArgsConstructor
public class InspectorDashboardService {

    static final int MAX_DAYS = 400;
    static final String NONE = "none";

    private final InspectorService inspectorService;
    private final ItpRecordRepository itpRecordRepository;
    private final AppointmentRepository appointmentRepository;

    private static final class Acc {
        final String key;
        final Long id;
        final String name;
        final String color;
        final boolean active;
        long itps, passed, failed, recheck, appointments, completed, noShows, todayAppointments;
        double revenue;
        Integer todayLine;
        boolean offToday;
        final Set<LocalDate> days = new HashSet<>();

        Acc(String key, Long id, String name, String color, boolean active) {
            this.key = key;
            this.id = id;
            this.name = name;
            this.color = color;
            this.active = active;
        }

        boolean empty() {
            return itps == 0 && appointments == 0 && todayLine == null && todayAppointments == 0;
        }

        InspectorStats stats() {
            return new InspectorStats(key, id, name, color, active, itps, passed, failed, recheck, revenue, days.size(),
                    appointments, completed, noShows, todayLine, todayAppointments, offToday);
        }
    }

    @Transactional(readOnly = true)
    public Dashboard dashboard(AppUser station, LocalDate from, LocalDate to, LocalDate today) {
        Plans.require(station, Plans.Feature.OWNER_REPORTS);
        if (from == null || to == null || to.isBefore(from)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Perioada nu este validă");
        if (ChronoUnit.DAYS.between(from, to) > MAX_DAYS) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Perioada este prea lungă");

        List<Inspector> team = inspectorService.all(station.getId());
        Map<String, Acc> rows = new LinkedHashMap<>();
        Map<Long, Acc> byId = new HashMap<>();
        Map<String, Acc> byName = new HashMap<>();
        for (Inspector i : team) {
            Acc a = new Acc("id:" + i.getId(), i.getId(), i.getName(), i.getColor(), i.isActive());
            a.offToday = i.isActive() && !InspectorService.worksOn(i, today);
            rows.put(a.key, a);
            byId.put(i.getId(), a);
            byName.put(key(i.getName()), a);
        }

        // ITP-urile din perioada, dupa numele inspectorului (nume vechi = rand separat, fara inspector = "Nespecificat")
        Map<LocalDate, Map<String, Long>> perDay = new TreeMap<>();
        for (ItpRecord r : itpRecordRepository.findByUserIdAndTestDateBetween(station.getId(), from, to)) {
            String name = r.getInspector() == null ? "" : r.getInspector().trim();
            Acc a = name.isEmpty()
                    ? rows.computeIfAbsent(NONE, k -> new Acc(NONE, null, ReportService.UNKNOWN_INSPECTOR, null, false))
                    : byName.computeIfAbsent(key(name), k -> rows.computeIfAbsent("name:" + name, kk -> new Acc(kk, null, name, null, false)));
            a.itps++;
            a.revenue += r.getPrice() != null ? r.getPrice() : 0.0;
            ItpStatus status = r.getStatus() != null ? r.getStatus() : ItpStatus.PASSED;
            switch (status) {
                case PASSED -> a.passed++;
                case FAILED -> a.failed++;
                case RECHECK -> a.recheck++;
            }
            a.days.add(r.getTestDate());
            perDay.computeIfAbsent(r.getTestDate(), d -> new HashMap<>()).merge(a.key, 1L, Long::sum);
        }

        // Programarile: inspectorul ales pe programare sau cel de pe linia ei in ziua aceea
        LocalDate apptFrom = from.isBefore(today) ? from : today;
        LocalDate apptTo = to.isAfter(today) ? to : today;
        Map<LocalDate, Map<Integer, Long>> lines = inspectorService.lineInspectors(station, apptFrom, apptTo);
        long appointments = 0, noShows = 0;
        for (Appointment ap : appointmentRepository.findByUserIdAndAppointmentDateBetweenOrderByAppointmentDateAsc(
                station.getId(), apptFrom.atStartOfDay(), apptTo.plusDays(1).atStartOfDay().minusNanos(1))) {
            if (ap.getStatus() == AppointmentStatus.CANCELLED) continue;
            LocalDate day = ap.getAppointmentDate().toLocalDate();
            Long inspectorId = ap.getInspectorId() != null ? ap.getInspectorId()
                    : ap.getLine() == null ? null : lines.getOrDefault(day, Map.of()).get(ap.getLine());
            Acc a = inspectorId == null ? null : byId.get(inspectorId);
            boolean inPeriod = !day.isBefore(from) && !day.isAfter(to);
            if (inPeriod) {
                appointments++;
                if (ap.getStatus() == AppointmentStatus.NO_SHOW) noShows++;
            }
            if (a == null) continue;
            if (inPeriod) {
                a.appointments++;
                if (ap.getStatus() == AppointmentStatus.COMPLETED) a.completed++;
                if (ap.getStatus() == AppointmentStatus.NO_SHOW) a.noShows++;
            }
            if (day.equals(today)) a.todayAppointments++;
        }
        lines.getOrDefault(today, Map.of()).forEach((line, id) -> {
            Acc a = byId.get(id);
            if (a != null && (a.todayLine == null || line < a.todayLine)) a.todayLine = line;
        });

        List<InspectorStats> stats = rows.values().stream()
                .filter(a -> a.id != null || !a.empty())
                .sorted(Comparator.comparing((Acc a) -> a.key.equals(NONE))
                        .thenComparing(a -> -a.itps)
                        .thenComparing(a -> a.name.toLowerCase(Locale.ROOT)))
                .map(Acc::stats)
                .toList();

        List<Day> days = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            Map<String, Long> counts = perDay.getOrDefault(d, Map.of());
            days.add(new Day(d, counts.values().stream().mapToLong(Long::longValue).sum(),
                    counts.entrySet().stream().map(e -> new DayCount(e.getKey(), e.getValue())).toList()));
        }

        long itps = stats.stream().mapToLong(InspectorStats::itps).sum();
        double revenue = stats.stream().mapToDouble(InspectorStats::revenue).sum();
        long failed = stats.stream().mapToLong(InspectorStats::failed).sum();
        int active = (int) team.stream().filter(Inspector::isActive).count();

        // Atestatele care expira in 60 de zile (sau au expirat), ale inspectorilor activi
        List<InspectorDTO> attestations = inspectorService.list(station).stream()
                .filter(i -> i.active() && i.attestationDaysLeft() != null && i.attestationDaysLeft() <= 60)
                .sorted(Comparator.comparing(InspectorDTO::attestationDaysLeft))
                .toList();

        return new Dashboard(from, to, new Totals(itps, revenue, failed, appointments, noShows, active), stats, days, attestations);
    }

    private static String key(String name) {
        return name.trim().toLowerCase(Locale.ROOT);
    }
}
