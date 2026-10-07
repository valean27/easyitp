package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.config.FieldException;
import org.example.easyitp.dto.InspectorDTOs.InspectorDTO;
import org.example.easyitp.dto.InspectorDTOs.InspectorRequest;
import org.example.easyitp.dto.InspectorDTOs.LineShiftDTO;
import org.example.easyitp.dto.InspectorDTOs.LineShiftRequest;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Inspector;
import org.example.easyitp.entity.LineShift;
import org.example.easyitp.entity.StationDeadline;
import org.example.easyitp.entity.StationDeadlineKind;
import org.example.easyitp.repository.InspectorRepository;
import org.example.easyitp.repository.LineShiftRepository;
import org.example.easyitp.repository.StationDeadlineRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

// Echipa de inspectori a statiei: cine sunt, pe ce linie lucreaza (de obicei sau intr-o anumita zi)
@Service
@RequiredArgsConstructor
public class InspectorService {

    public static final List<String> COLORS = List.of("blue", "orange", "aqua", "yellow", "magenta", "green", "violet", "red");
    static final int MAX_INSPECTORS = 30;
    private static final int MAX_NAME = 80;

    private final InspectorRepository repository;
    private final LineShiftRepository shiftRepository;
    private final StationDeadlineRepository deadlineRepository;

    @Transactional(readOnly = true)
    public List<InspectorDTO> list(AppUser station) {
        List<StationDeadline> attestations = attestations(station.getId());
        LocalDate today = LocalDate.now();
        return all(station.getId()).stream().map(i -> dto(i, attestation(attestations, i.getName()), today)).toList();
    }

    public List<Inspector> all(Long stationId) {
        return repository.findByUserIdOrderByPositionAscIdAsc(stationId);
    }

    // Numele inspectorilor activi, pentru formularul ITP si termenele statiei
    @Transactional(readOnly = true)
    public List<String> activeNames(AppUser station) {
        return all(station.getId()).stream().filter(Inspector::isActive).map(Inspector::getName).toList();
    }

    @Transactional
    public InspectorDTO create(AppUser station, InspectorRequest request) {
        List<Inspector> team = all(station.getId());
        if (team.size() >= MAX_INSPECTORS) throw new FieldException("name", "Maxim " + MAX_INSPECTORS + " inspectori.");
        Inspector inspector = Inspector.builder()
                .userId(station.getId())
                .active(true)
                .position(team.stream().mapToInt(Inspector::getPosition).max().orElse(-1) + 1)
                .createdAt(LocalDateTime.now())
                .build();
        apply(station, inspector, request, team);
        if (inspector.getColor() == null) inspector.setColor(freeColor(team));
        Inspector saved = repository.save(inspector);
        saveAttestation(station, null, saved.getName(), request.attestationUntil());
        return dto(saved, attestation(attestations(station.getId()), saved.getName()), LocalDate.now());
    }

    @Transactional
    public InspectorDTO update(AppUser station, Long id, InspectorRequest request) {
        Inspector inspector = find(station, id);
        String oldName = inspector.getName();
        apply(station, inspector, request, all(station.getId()));
        if (request.active() != null) inspector.setActive(request.active());
        Inspector saved = repository.save(inspector);
        if (!oldName.equals(saved.getName())) repository.renameOnItps(station.getId(), oldName, saved.getName());
        saveAttestation(station, oldName, saved.getName(), request.attestationUntil());
        return dto(saved, attestation(attestations(station.getId()), saved.getName()), LocalDate.now());
    }

    // ITP-urile pastreaza numele; programarile si liniile raman fara inspector
    @Transactional
    public void delete(AppUser station, Long id) {
        Inspector inspector = find(station, id);
        repository.unlinkAppointments(id);
        shiftRepository.unlinkInspector(id);
        attestation(attestations(station.getId()), inspector.getName()).ifPresent(deadlineRepository::delete);
        repository.delete(inspector);
    }

    // Lista simpla de nume (Contul meu, versiunile vechi): pastreaza inspectorii cu acelasi nume, adauga numele noi
    // si scoate inspectorii care nu mai sunt in lista
    @Transactional
    public List<String> replaceNames(AppUser station, List<String> names) {
        Map<String, String> unique = new LinkedHashMap<>();
        for (String name : names == null ? List.<String>of() : names) {
            String trimmed = name == null ? "" : name.trim().replaceAll("\\s+", " ");
            if (trimmed.isEmpty()) continue;
            if (trimmed.length() > MAX_NAME) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Numele inspectorului este prea lung");
            unique.putIfAbsent(key(trimmed), trimmed);
        }
        if (unique.size() > MAX_INSPECTORS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Maxim " + MAX_INSPECTORS + " inspectori");
        }
        List<Inspector> team = new ArrayList<>(all(station.getId()));
        for (Inspector i : List.copyOf(team)) {
            if (!unique.containsKey(key(i.getName()))) {
                delete(station, i.getId());
                team.remove(i);
            }
        }
        int position = 0;
        for (String name : unique.values()) {
            Inspector existing = team.stream().filter(i -> key(i.getName()).equals(key(name))).findFirst().orElse(null);
            if (existing == null) {
                Inspector created = Inspector.builder().userId(station.getId()).name(name).active(true).position(position)
                        .color(freeColor(team)).createdAt(LocalDateTime.now()).build();
                team.add(repository.save(created));
            } else {
                existing.setPosition(position);
                existing.setActive(true);
            }
            position++;
        }
        return activeNames(station);
    }

    // ---------- liniile ----------

    @Transactional(readOnly = true)
    public List<LineShiftDTO> shifts(AppUser station, LocalDate date) {
        Map<Integer, LineShift> explicit = new HashMap<>();
        shiftRepository.findByUserIdAndDayBetween(station.getId(), date, date).forEach(s -> explicit.put(s.getLine(), s));
        List<Inspector> team = all(station.getId());
        List<String> names = BookingService.lineNames(station);
        List<LineShiftDTO> out = new ArrayList<>();
        for (int line = 1; line <= BookingService.lines(station); line++) {
            String name = names.get(line - 1).isEmpty() ? "Linia " + line : names.get(line - 1);
            LineShift s = explicit.get(line);
            if (s != null) {
                out.add(new LineShiftDTO(line, name, s.getInspectorId(), "DAY"));
            } else {
                Long def = defaultFor(team, line);
                out.add(new LineShiftDTO(line, name, def, def == null ? "NONE" : "DEFAULT"));
            }
        }
        return out;
    }

    @Transactional
    public List<LineShiftDTO> setShift(AppUser station, LineShiftRequest request) {
        if (request.date() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Alegeți ziua");
        if (request.line() == null || request.line() < 1 || request.line() > BookingService.lines(station)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Linia nu există");
        }
        if (request.inspectorId() != null) find(station, request.inspectorId());
        Optional<LineShift> existing = shiftRepository.findByUserIdAndDayAndLine(station.getId(), request.date(), request.line());
        if (request.reset()) {
            existing.ifPresent(shiftRepository::delete);
        } else {
            LineShift shift = existing.orElseGet(() -> LineShift.builder().userId(station.getId()).day(request.date()).line(request.line()).build());
            shift.setInspectorId(request.inspectorId());
            shiftRepository.save(shift);
        }
        shiftRepository.flush();
        return shifts(station, request.date());
    }

    // Pentru fiecare zi din interval: linia -> inspectorul care lucreaza pe ea (lipsa = nimeni)
    @Transactional(readOnly = true)
    public Map<LocalDate, Map<Integer, Long>> lineInspectors(AppUser station, LocalDate from, LocalDate to) {
        List<Inspector> team = all(station.getId());
        Map<Integer, Long> defaults = new HashMap<>();
        for (int line = 1; line <= BookingService.lines(station); line++) {
            Long def = defaultFor(team, line);
            if (def != null) defaults.put(line, def);
        }
        Map<LocalDate, Map<Integer, Long>> out = new HashMap<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) out.put(d, new HashMap<>(defaults));
        for (LineShift s : shiftRepository.findByUserIdAndDayBetween(station.getId(), from, to)) {
            Map<Integer, Long> day = out.computeIfAbsent(s.getDay(), k -> new HashMap<>(defaults));
            if (s.getInspectorId() == null) day.remove(s.getLine());
            else day.put(s.getLine(), s.getInspectorId());
        }
        return out;
    }

    // Inspectorul ales pe o programare trebuie sa fie al statiei
    public void requireOwn(AppUser station, Long inspectorId) {
        if (inspectorId != null) find(station, inspectorId);
    }

    // ---------- interne ----------

    private Inspector find(AppUser station, Long id) {
        return repository.findByIdAndUserId(id, station.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inspectorul nu există"));
    }

    private static Long defaultFor(List<Inspector> team, int line) {
        return team.stream().filter(i -> i.isActive() && Objects.equals(i.getDefaultLine(), line)).map(Inspector::getId).findFirst().orElse(null);
    }

    private void apply(AppUser station, Inspector inspector, InspectorRequest r, List<Inspector> team) {
        String name = r.name() == null ? "" : r.name().trim().replaceAll("\\s+", " ");
        if (name.isEmpty()) throw new FieldException("name", "Introduceți numele inspectorului.");
        if (name.length() > MAX_NAME) throw new FieldException("name", "Numele este prea lung.");
        boolean taken = team.stream().anyMatch(i -> !Objects.equals(i.getId(), inspector.getId()) && key(i.getName()).equals(key(name)));
        if (taken) throw new FieldException("name", "Există deja un inspector cu acest nume.");
        String phone = r.phone() == null || r.phone().isBlank() ? null : r.phone().trim();
        if (phone != null) {
            int digits = phone.replaceAll("\\D", "").length();
            if (digits < 9 || digits > 15 || phone.length() > 20) throw new FieldException("phone", "Numărul de telefon nu este valid.");
        }
        if (r.defaultLine() != null && (r.defaultLine() < 1 || r.defaultLine() > BookingService.lines(station))) {
            throw new FieldException("defaultLine", "Stația are " + BookingService.lines(station) + " linii.");
        }
        if (r.color() != null && !COLORS.contains(r.color())) throw new FieldException("color", "Culoare necunoscută.");
        inspector.setName(name);
        inspector.setPhone(phone);
        inspector.setDefaultLine(r.defaultLine());
        if (r.color() != null) inspector.setColor(r.color());
    }

    private static String freeColor(List<Inspector> team) {
        Set<String> used = new java.util.HashSet<>();
        team.forEach(i -> used.add(i.getColor()));
        return COLORS.stream().filter(c -> !used.contains(c)).findFirst().orElse(COLORS.get(team.size() % COLORS.size()));
    }

    private static String key(String name) {
        return name.trim().toLowerCase(Locale.ROOT);
    }

    // Atestatul inspectorului e un termen al statiei (tipul "Atestat inspector", cu numele lui), ca sa apara in
    // alerta de pe dashboard si in rezumatul zilnic; se schimba doar pe pachetul care are termenele statiei
    private void saveAttestation(AppUser station, String oldName, String name, LocalDate until) {
        if (!Plans.allows(station, Plans.Feature.STATION_DEADLINES)) return;
        List<StationDeadline> all = attestations(station.getId());
        Optional<StationDeadline> existing = attestation(all, oldName != null ? oldName : name);
        if (until == null) {
            existing.ifPresent(deadlineRepository::delete);
            return;
        }
        if (until.isBefore(LocalDate.of(2000, 1, 1)) || until.isAfter(LocalDate.now().plusYears(20))) {
            throw new FieldException("attestationUntil", "Data atestatului nu este validă.");
        }
        StationDeadline d = existing.orElseGet(() -> StationDeadline.builder().userId(station.getId())
                .kind(StationDeadlineKind.ATESTAT_INSPECTOR).createdAt(LocalDateTime.now()).build());
        d.setTitle(name);
        d.setDueDate(until);
        deadlineRepository.save(d);
    }

    private List<StationDeadline> attestations(Long stationId) {
        return deadlineRepository.findByUserIdOrderByDueDateAsc(stationId).stream()
                .filter(d -> d.getKind() == StationDeadlineKind.ATESTAT_INSPECTOR && d.getTitle() != null).toList();
    }

    private static Optional<StationDeadline> attestation(List<StationDeadline> all, String name) {
        return all.stream().filter(d -> key(d.getTitle()).equals(key(name))).findFirst();
    }

    static InspectorDTO dto(Inspector i, Optional<StationDeadline> attestation, LocalDate today) {
        LocalDate until = attestation.map(StationDeadline::getDueDate).orElse(null);
        return new InspectorDTO(i.getId(), i.getName(), i.getPhone(), i.getColor(), i.isActive(), i.getDefaultLine(), until,
                until == null ? null : ChronoUnit.DAYS.between(today, until));
    }
}
