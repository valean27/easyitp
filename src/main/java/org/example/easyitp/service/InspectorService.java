package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.config.FieldException;
import org.example.easyitp.dto.InspectorDTOs.AccountRequest;
import org.example.easyitp.dto.InspectorDTOs.DayDTO;
import org.example.easyitp.dto.InspectorDTOs.InspectorDTO;
import org.example.easyitp.dto.InspectorDTOs.InspectorRequest;
import org.example.easyitp.dto.InspectorDTOs.LineShiftDTO;
import org.example.easyitp.dto.InspectorDTOs.LineShiftRequest;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Inspector;
import org.example.easyitp.entity.InspectorDay;
import org.example.easyitp.entity.LineShift;
import org.example.easyitp.entity.Role;
import org.example.easyitp.entity.StationDeadline;
import org.example.easyitp.entity.StationDeadlineKind;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.InspectorRepository;
import org.example.easyitp.repository.LineShiftRepository;
import org.example.easyitp.repository.StationDeadlineRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

// Echipa de inspectori a statiei: cine sunt, cand si pe ce linie lucreaza (programul saptamanal sau o zi anume)
// si contul lor propriu
@Service
@RequiredArgsConstructor
public class InspectorService {

    public static final List<String> COLORS = List.of("blue", "orange", "aqua", "yellow", "magenta", "green", "violet", "red");
    static final int MAX_INSPECTORS = 30;
    private static final int MAX_NAME = 80;
    static final int MIN_PASSWORD_LENGTH = 8;

    private final InspectorRepository repository;
    private final LineShiftRepository shiftRepository;
    private final StationDeadlineRepository deadlineRepository;
    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public List<InspectorDTO> list(AppUser station) {
        List<StationDeadline> attestations = attestations(station.getId());
        List<Inspector> team = all(station.getId());
        Map<Long, String> logins = logins(team);
        LocalDate today = LocalDate.now();
        return team.stream().map(i -> dto(i, attestation(attestations, i.getName()), today, logins.get(i.getId()))).toList();
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
        return dto(station, saved);
    }

    @Transactional
    public InspectorDTO update(AppUser station, Long id, InspectorRequest request) {
        Inspector inspector = find(station, id);
        String oldName = inspector.getName();
        apply(station, inspector, request, all(station.getId()));
        if (request.active() != null && request.active() != inspector.isActive()) {
            inspector.setActive(request.active());
            // contul urmeaza inspectorul: inactiv = nu se mai poate loga
            appUserRepository.findByInspectorId(id).ifPresent(account -> {
                account.setActive(request.active());
                if (!request.active()) account.revokeTokens();
                appUserRepository.save(account);
            });
        }
        Inspector saved = repository.save(inspector);
        if (!oldName.equals(saved.getName())) repository.renameOnItps(station.getId(), oldName, saved.getName());
        saveAttestation(station, oldName, saved.getName(), request.attestationUntil());
        return dto(station, saved);
    }

    // ITP-urile pastreaza numele; programarile si liniile raman fara inspector; contul lui dispare
    @Transactional
    public void delete(AppUser station, Long id) {
        Inspector inspector = find(station, id);
        appUserRepository.findByInspectorId(id).ifPresent(appUserRepository::delete);
        repository.unlinkAppointments(id);
        shiftRepository.unlinkInspector(id);
        attestation(attestations(station.getId()), inspector.getName()).ifPresent(deadlineRepository::delete);
        repository.delete(inspector);
    }

    // Lista simpla de nume (versiunile vechi): pastreaza inspectorii cu acelasi nume, adauga numele noi
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

    // ---------- contul propriu ----------

    // Creeaza contul inspectorului sau ii schimba numele de logare / parola. Parola data de manager se schimba
    // la prima logare.
    @Transactional
    public InspectorDTO saveAccount(AppUser station, Long id, AccountRequest request) {
        Inspector inspector = find(station, id);
        AppUser account = appUserRepository.findByInspectorId(id).orElse(null);
        String login = request.login() == null || request.login().isBlank()
                ? (account != null ? account.getEmail() : suggestLogin(station, inspector))
                : request.login().trim().toLowerCase(Locale.ROOT);
        if (!InspectorLogins.valid(login)) {
            throw new FieldException("login", "Numele de logare poate avea litere mici, cifre, punct și cratimă, cu un @ (ex. ana.marin@statie).");
        }
        boolean taken = appUserRepository.findByEmailIgnoreCase(login)
                .filter(u -> account == null || !Objects.equals(u.getId(), account.getId()))
                .isPresent();
        if (taken) throw new FieldException("login", "Numele de logare este deja folosit.");
        String password = request.password() == null ? "" : request.password();
        if ((account == null || !password.isEmpty()) && password.length() < MIN_PASSWORD_LENGTH) {
            throw new FieldException("password", "Parola trebuie să aibă cel puțin " + MIN_PASSWORD_LENGTH + " caractere.");
        }
        AppUser user = account != null ? account
                : AppUser.builder().role(Role.INSPECTOR).inspectorId(id).active(inspector.isActive()).build();
        user.setEmail(login);
        user.setStationName(station.getStationName());
        if (!password.isEmpty()) {
            user.setPassword(passwordEncoder.encode(password));
            user.setPasswordChangeRequired(true);
            user.revokeTokens();
        }
        appUserRepository.save(user);
        return dto(station, inspector);
    }

    @Transactional
    public InspectorDTO deleteAccount(AppUser station, Long id) {
        Inspector inspector = find(station, id);
        appUserRepository.findByInspectorId(id).ifPresent(appUserRepository::delete);
        return dto(station, inspector);
    }

    // Numele de logare propus pentru un inspector fara cont
    public String suggestLogin(AppUser station, Inspector inspector) {
        return InspectorLogins.suggest(inspector.getName(), station.getBookingSlug(), station.getId(),
                login -> appUserRepository.existsByEmailIgnoreCase(login));
    }

    // Inspectorul si statia unui cont INSPECTOR (403 daca statia sau inspectorul nu mai sunt active)
    @Transactional(readOnly = true)
    public Inspector inspectorOf(AppUser account) {
        if (account.getRole() != Role.INSPECTOR || account.getInspectorId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Contul nu este de inspector");
        }
        Inspector inspector = repository.findById(account.getInspectorId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Inspectorul nu mai există"));
        if (!inspector.isActive()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Contul este dezactivat");
        return inspector;
    }

    // ---------- programul si liniile ----------

    // In ziua respectiva lucreaza? Fara program fix: in fiecare zi
    public static boolean worksOn(Inspector i, LocalDate date) {
        return i.getSchedule().isEmpty() || dayOf(i, date).isPresent();
    }

    public static Optional<InspectorDay> dayOf(Inspector i, LocalDate date) {
        int weekday = date.getDayOfWeek().getValue();
        return i.getSchedule().stream().filter(d -> d.getWeekday() == weekday).findFirst();
    }

    // Linia lui in ziua respectiva, dupa program (null = nu lucreaza sau n-are linie)
    public static Integer lineOn(Inspector i, LocalDate date) {
        if (!i.isActive() || !worksOn(i, date)) return null;
        Integer dayLine = dayOf(i, date).map(InspectorDay::getLine).orElse(null);
        return dayLine != null ? dayLine : i.getDefaultLine();
    }

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
                Long def = defaultFor(team, line, date);
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
        int lines = BookingService.lines(station);
        Map<LocalDate, Map<Integer, Long>> out = new HashMap<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            Map<Integer, Long> day = new HashMap<>();
            for (int line = 1; line <= lines; line++) {
                Long def = defaultFor(team, line, d);
                if (def != null) day.put(line, def);
            }
            out.put(d, day);
        }
        for (LineShift s : shiftRepository.findByUserIdAndDayBetween(station.getId(), from, to)) {
            Map<Integer, Long> day = out.computeIfAbsent(s.getDay(), k -> new HashMap<>());
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

    private static Long defaultFor(List<Inspector> team, int line, LocalDate date) {
        return team.stream().filter(i -> Objects.equals(lineOn(i, date), line)).map(Inspector::getId).findFirst().orElse(null);
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
        int lines = BookingService.lines(station);
        if (r.defaultLine() != null && (r.defaultLine() < 1 || r.defaultLine() > lines)) {
            throw new FieldException("defaultLine", "Stația are " + lines + " linii.");
        }
        if (r.color() != null && !COLORS.contains(r.color())) throw new FieldException("color", "Culoare necunoscută.");
        if (r.schedule() != null) {
            Set<Integer> seen = new HashSet<>();
            List<InspectorDay> days = new ArrayList<>();
            for (DayDTO d : r.schedule()) {
                if (d.weekday() < 1 || d.weekday() > 7 || !seen.add(d.weekday())) throw new FieldException("schedule", "Zilele programului nu sunt valide.");
                if (d.line() != null && (d.line() < 1 || d.line() > lines)) throw new FieldException("schedule", "Stația are " + lines + " linii.");
                if ((d.start() == null) != (d.end() == null) || (d.start() != null && !d.start().isBefore(d.end()))) {
                    throw new FieldException("schedule", "Ora de început trebuie să fie înaintea celei de sfârșit.");
                }
                days.add(new InspectorDay(d.weekday(), d.line(), d.start(), d.end()));
            }
            days.sort(Comparator.comparing(InspectorDay::getWeekday));
            inspector.getSchedule().clear();
            inspector.getSchedule().addAll(days);
        }
        inspector.setName(name);
        inspector.setPhone(phone);
        inspector.setDefaultLine(r.defaultLine());
        if (r.color() != null) inspector.setColor(r.color());
    }

    private static String freeColor(List<Inspector> team) {
        Set<String> used = new HashSet<>();
        team.forEach(i -> used.add(i.getColor()));
        return COLORS.stream().filter(c -> !used.contains(c)).findFirst().orElse(COLORS.get(team.size() % COLORS.size()));
    }

    private static String key(String name) {
        return name.trim().toLowerCase(Locale.ROOT);
    }

    private Map<Long, String> logins(List<Inspector> team) {
        if (team.isEmpty()) return Map.of();
        return appUserRepository.findByInspectorIdIn(team.stream().map(Inspector::getId).toList()).stream()
                .collect(Collectors.toMap(AppUser::getInspectorId, AppUser::getEmail, (a, b) -> a));
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

    private InspectorDTO dto(AppUser station, Inspector i) {
        return dto(i, attestation(attestations(station.getId()), i.getName()), LocalDate.now(),
                appUserRepository.findByInspectorId(i.getId()).map(AppUser::getEmail).orElse(null));
    }

    static InspectorDTO dto(Inspector i, Optional<StationDeadline> attestation, LocalDate today, String login) {
        LocalDate until = attestation.map(StationDeadline::getDueDate).orElse(null);
        List<DayDTO> schedule = i.getSchedule().stream()
                .map(d -> new DayDTO(d.getWeekday(), d.getLine(), d.getStart(), d.getEnd())).toList();
        return new InspectorDTO(i.getId(), i.getName(), i.getPhone(), i.getColor(), i.isActive(), i.getDefaultLine(), until,
                until == null ? null : ChronoUnit.DAYS.between(today, until), schedule, login);
    }
}
