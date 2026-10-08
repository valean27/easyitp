package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.BookingSettingsDTO;
import org.example.easyitp.dto.PublicBookingRequest;
import org.example.easyitp.dto.PublicStationDTO;
import org.example.easyitp.dto.PublicStationSummaryDTO;
import org.example.easyitp.dto.VehicleTypeDTO;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Appointment;
import org.example.easyitp.entity.AppointmentSource;
import org.example.easyitp.entity.AppointmentStatus;
import org.example.easyitp.entity.Role;
import org.example.easyitp.entity.VehicleCategory;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.AppointmentRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeSet;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

// Programarea online de pe pagina publica a statiei (/programare/{slug})
@Service
@RequiredArgsConstructor
public class BookingService {

    public static final int MAX_DAYS_AHEAD = 30;
    // Clientul nu se poate programa cu mai putin de o ora inainte
    private static final int MIN_LEAD_MINUTES = 60;
    // Orele oferite si duratele sunt multipli de 5 minute
    private static final int ALIGN_MINUTES = 5;

    private static final LocalTime DEFAULT_OPEN = LocalTime.of(8, 0);
    private static final LocalTime DEFAULT_CLOSE = LocalTime.of(17, 0);
    private static final String DEFAULT_DAYS = "1,2,3,4,5";
    private static final int DEFAULT_CAPACITY = 1;
    private static final int MAX_CAPACITY = 10;
    private static final int MAX_LINE_NAME = 40;

    private static final Pattern SLUG = Pattern.compile("^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$");

    private final AppUserRepository appUserRepository;
    private final AppointmentRepository appointmentRepository;

    // ---------- setarile managerului ----------

    public BookingSettingsDTO getSettings(AppUser user) {
        return new BookingSettingsDTO(
                Boolean.TRUE.equals(user.getBookingEnabled()),
                user.getBookingSlug(),
                open(user),
                close(user),
                days(user),
                capacity(user),
                InspectionDurations.allTypes(user),
                !Boolean.FALSE.equals(user.getPublicListing()),
                lineNames(user),
                !Boolean.FALSE.equals(user.getBookingEmailNotify()));
    }

    // Statiile active cu programarea online pornita care accepta sa apara in lista publica, dupa nume
    @Transactional(readOnly = true)
    public List<PublicStationSummaryDTO> directory() {
        return appUserRepository.findByRoleOrderByIdAsc(Role.MANAGER).stream()
                .filter(u -> u.isEnabled() && Boolean.TRUE.equals(u.getBookingEnabled()) && u.getBookingSlug() != null
                        && !Boolean.FALSE.equals(u.getPublicListing()))
                .map(u -> new PublicStationSummaryDTO(u.getStationName() != null ? u.getStationName() : "Stație ITP",
                        u.getBookingSlug(), u.getAddress(), u.getPhone(), open(u), close(u), days(u), u.getMapsUrl(),
                        rating(u), rating(u) == null ? null : u.getGoogleRatingCount()))
                .sorted(java.util.Comparator.comparing(s -> s.name().toLowerCase(java.util.Locale.ROOT)))
                .toList();
    }

    @Transactional
    public BookingSettingsDTO updateSettings(AppUser user, BookingSettingsDTO dto) {
        if (dto.getOpen() == null || dto.getClose() == null || !dto.getOpen().isBefore(dto.getClose())) {
            throw badRequest("Ora de deschidere trebuie sa fie inaintea orei de inchidere");
        }
        List<Integer> days = dto.getDays() == null ? List.of() : dto.getDays().stream().distinct().sorted().toList();
        if (days.isEmpty() || days.stream().anyMatch(d -> d < 1 || d > 7)) {
            throw badRequest("Alegeti cel putin o zi lucratoare");
        }
        if (dto.getCapacity() < 1 || dto.getCapacity() > MAX_CAPACITY) {
            throw badRequest("Numarul de linii trebuie sa fie intre 1 si " + MAX_CAPACITY);
        }
        Map<VehicleCategory, Integer> durations = durations(dto.getVehicleTypes());
        if (dto.getLineNames() != null && dto.getLineNames().stream().anyMatch(n -> n != null && n.trim().length() > MAX_LINE_NAME)) {
            throw badRequest("Numele unei linii poate avea cel mult " + MAX_LINE_NAME + " de caractere");
        }

        String slug = dto.getSlug() == null ? "" : dto.getSlug().trim().toLowerCase();
        if (slug.isEmpty()) {
            slug = user.getBookingSlug() != null ? user.getBookingSlug() : uniqueSlug(user.getStationName());
        } else if (!SLUG.matcher(slug).matches()) {
            throw badRequest("Link-ul poate contine doar litere mici, cifre si cratime (3-40 caractere)");
        } else if (!slug.equals(user.getBookingSlug()) && appUserRepository.existsByBookingSlug(slug)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Link-ul este deja folosit de alta statie");
        }

        user.setBookingEnabled(dto.isEnabled());
        user.setBookingSlug(slug);
        user.setBookingOpen(dto.getOpen());
        user.setBookingClose(dto.getClose());
        user.setBookingDays(days.stream().map(String::valueOf).collect(Collectors.joining(",")));
        user.setBookingCapacity(dto.getCapacity());
        if (dto.getPublicListing() != null) user.setPublicListing(dto.getPublicListing());
        if (dto.getEmailNotify() != null) user.setBookingEmailNotify(dto.getEmailNotify());
        if (dto.getLineNames() != null) user.setBookingLineNames(formatLineNames(dto.getLineNames(), dto.getCapacity()));
        // Clientii vechi nu trimit tipurile: pastram ce era salvat
        if (durations != null) user.setBookingDurations(InspectionDurations.format(durations));
        return getSettings(appUserRepository.save(user));
    }

    private static Map<VehicleCategory, Integer> durations(List<VehicleTypeDTO> types) {
        if (types == null) return null;
        Map<VehicleCategory, Integer> durations = new EnumMap<>(VehicleCategory.class);
        for (VehicleTypeDTO type : types) {
            if (type.category() == null || !type.enabled()) continue;
            if (type.minutes() < InspectionDurations.MIN_MINUTES || type.minutes() > InspectionDurations.MAX_MINUTES
                    || type.minutes() % ALIGN_MINUTES != 0) {
                throw badRequest("Durata pentru " + type.category().label() + " trebuie sa fie intre "
                        + InspectionDurations.MIN_MINUTES + " si " + InspectionDurations.MAX_MINUTES
                        + " de minute, din 5 in 5");
            }
            durations.put(type.category(), type.minutes());
        }
        if (durations.isEmpty()) throw badRequest("Alegeti cel putin un tip de vehicul");
        return durations;
    }

    // "ITP Auto Cluj-Napoca" -> "itp-auto-cluj-napoca"; adauga sufix daca e deja luat
    String uniqueSlug(String stationName) {
        String base = Normalizer.normalize(Objects.toString(stationName, ""), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-+|-+$)", "");
        if (base.length() > 34) base = base.substring(0, 34).replaceAll("-+$", "");
        if (base.length() < 3) base = "statie-itp";
        String slug = base;
        for (int i = 2; appUserRepository.existsByBookingSlug(slug); i++) {
            slug = base + "-" + i;
        }
        return slug;
    }

    // ---------- pagina publica ----------

    public PublicStationDTO publicStation(String slug) {
        AppUser station = findStation(slug);
        return new PublicStationDTO(
                station.getStationName() != null ? station.getStationName() : "Stație ITP",
                station.getAddress(),
                station.getPhone(),
                open(station),
                close(station),
                days(station),
                MAX_DAYS_AHEAD,
                InspectionDurations.allTypes(station).stream().filter(VehicleTypeDTO::enabled).toList(),
                station.getMapsUrl(), station.getFacebookUrl(), station.getReviewUrl(), rating(station),
                rating(station) == null ? null : station.getGoogleRatingCount());
    }

    // Nota Google se arata doar pe Premium (si nu se mai reimprospateaza fara el; Google nu permite note vechi)
    private static Double rating(AppUser station) {
        return Plans.allows(station, Plans.Feature.REVIEWS) ? station.getGoogleRating() : null;
    }

    public List<LocalTime> availableSlots(String slug, LocalDate date, VehicleCategory category) {
        AppUser station = findStation(slug);
        return availableSlots(station, date, onlineCategory(station, category), LocalDateTime.now());
    }

    List<LocalTime> availableSlots(AppUser station, LocalDate date, VehicleCategory category, LocalDateTime now) {
        return availableSlots(station, date, category, now, null);
    }

    // Orele la care o inspectie de tipul "category" incape intreaga pe una din liniile statiei.
    // Se ofera orele din grila tipului (deschidere + k * durata) si orele la care se termina alte programari,
    // ca un vehicul sa poata intra imediat dupa altul, fara goluri pe linie.
    // excludeId: programarea care se muta (nu se blocheaza singura)
    List<LocalTime> availableSlots(AppUser station, LocalDate date, VehicleCategory category, LocalDateTime now, Long excludeId) {
        LocalDate today = now.toLocalDate();
        if (date.isBefore(today) || date.isAfter(today.plusDays(MAX_DAYS_AHEAD))) return List.of();
        if (!days(station).contains(date.getDayOfWeek().getValue())) return List.of();

        int duration = InspectionDurations.minutesFor(station, category);
        LocalDateTime dayOpen = date.atTime(open(station));
        LocalDateTime dayClose = date.atTime(close(station));
        List<LinePlanner.Booked> booked = dayBooked(station, date, excludeId);
        List<Interval> taken = booked.stream()
                .map(b -> new Interval(b.start(), b.end()))
                .filter(i -> i.end().isAfter(dayOpen))
                .toList();

        TreeSet<LocalDateTime> candidates = new TreeSet<>();
        for (LocalDateTime t = dayOpen; !t.plusMinutes(duration).isAfter(dayClose); t = t.plusMinutes(duration)) {
            candidates.add(t);
        }
        taken.forEach(i -> candidates.add(alignUp(i.end())));

        LocalDateTime earliest = now.plusMinutes(MIN_LEAD_MINUTES);
        int capacity = capacity(station);
        List<LocalTime> slots = new ArrayList<>();
        for (LocalDateTime start : candidates) {
            LocalDateTime end = start.plusMinutes(duration);
            if (start.isBefore(dayOpen) || end.isAfter(dayClose) || start.isBefore(earliest)) continue;
            // o linie trebuie sa fie libera tot intervalul (nu doar numarul de masini sub capacitate)
            if (maxConcurrent(taken, start, end) < capacity && LinePlanner.freeLine(booked, capacity, start, end, null) != null) {
                slots.add(start.toLocalTime());
            }
        }
        return slots;
    }

    record Interval(LocalDateTime start, LocalDateTime end) {
    }

    // Programarile active din ziua respectiva (plus cele incepute inainte care inca ruleaza), fara excludeId
    public List<LinePlanner.Booked> dayBooked(AppUser station, LocalDate date, Long excludeId) {
        return appointmentRepository
                .findActiveBetween(station.getId(), date.atStartOfDay().minusMinutes(InspectionDurations.MAX_MINUTES),
                        date.plusDays(1).atStartOfDay())
                .stream()
                .filter(a -> excludeId == null || !excludeId.equals(a.getId()))
                .map(BookingService::booked)
                .toList();
    }

    public static LinePlanner.Booked booked(Appointment a) {
        return new LinePlanner.Booked(a.getId(), a.getAppointmentDate(),
                a.getAppointmentDate().plusMinutes(InspectionDurations.minutesOf(a)), a.getLine());
    }

    // Linia pentru o programare: cea preferata daca e libera, altfel prima libera; null = toate ocupate
    public Integer pickLine(AppUser station, LocalDateTime start, int minutes, Long excludeId, Integer preferred) {
        return LinePlanner.freeLine(dayBooked(station, start.toLocalDate(), excludeId), lines(station), start,
                start.plusMinutes(minutes), preferred);
    }

    // Cate programari ruleaza simultan, cel mult, in [start, end). Maximul se atinge
    // fie la start, fie la inceputul unei programari care incepe in interval.
    static int maxConcurrent(List<Interval> taken, LocalDateTime start, LocalDateTime end) {
        List<Interval> overlapping = taken.stream()
                .filter(i -> i.start().isBefore(end) && i.end().isAfter(start))
                .toList();
        int max = 0;
        for (Interval probe : overlapping) {
            LocalDateTime point = probe.start().isAfter(start) ? probe.start() : start;
            int count = (int) overlapping.stream()
                    .filter(i -> !i.start().isAfter(point) && i.end().isAfter(point))
                    .count();
            max = Math.max(max, count);
        }
        return max;
    }

    private static LocalDateTime alignUp(LocalDateTime t) {
        LocalDateTime minute = t.withSecond(0).withNano(0);
        if (minute.isBefore(t)) minute = minute.plusMinutes(1);
        int extra = minute.getMinute() % ALIGN_MINUTES;
        return extra == 0 ? minute : minute.plusMinutes(ALIGN_MINUTES - extra);
    }

    // Tipul cerut de client, daca statia il primeste online; fara tip (pagini vechi) primul tip activ
    private static VehicleCategory onlineCategory(AppUser station, VehicleCategory requested) {
        Map<VehicleCategory, Integer> active = InspectionDurations.of(station);
        if (requested == null) return active.keySet().stream().findFirst().orElse(VehicleCategory.CAR);
        if (!active.containsKey(requested)) {
            throw badRequest("Statia nu primeste programari online pentru acest tip de vehicul");
        }
        return requested;
    }

    @Transactional
    public Appointment book(String slug, PublicBookingRequest req) {
        AppUser station = findStation(slug);

        String name = req.getClientName() == null ? "" : req.getClientName().trim();
        if (name.length() < 2 || name.length() > 80) throw badRequest("Introduceti numele");
        // numar real de mobil, din Romania sau (cu prefixul tarii) din alta tara
        String phone = PhoneNumbers.requireMobile(req.getPhone());
        String email = BookingEvents.optionalEmail(req.getEmail());
        String plate = req.getLicensePlate() == null ? "" : req.getLicensePlate().trim().toUpperCase();
        if (plate.length() > 15) throw badRequest("Numar de inmatriculare invalid");
        if (req.getAppointmentDate() == null) throw badRequest("Alegeti data si ora");

        VehicleCategory category = onlineCategory(station, req.getVehicleCategory());
        LocalDateTime when = req.getAppointmentDate().withSecond(0).withNano(0);
        if (!availableSlots(station, when.toLocalDate(), category, LocalDateTime.now()).contains(when.toLocalTime())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ora aleasa nu mai este disponibila");
        }

        return appointmentRepository.save(Appointment.builder()
                .clientName(name)
                .phone(phone)
                .email(email)
                .licensePlate(plate.isEmpty() ? null : plate)
                .appointmentDate(when)
                .status(AppointmentStatus.SCHEDULED)
                .source(AppointmentSource.ONLINE)
                .vehicleCategory(category)
                .durationMinutes(InspectionDurations.minutesFor(station, category))
                .line(pickLine(station, when, InspectionDurations.minutesFor(station, category), null, null))
                .reminderConsent(Boolean.TRUE.equals(req.getReminderConsent()))
                .user(station)
                .build());
    }

    // Doar statiile active cu programarea online pornita sunt publice
    private AppUser findStation(String slug) {
        return appUserRepository.findByBookingSlug(slug == null ? "" : slug.toLowerCase())
                .filter(u -> u.getRole() == Role.MANAGER && u.isEnabled() && Boolean.TRUE.equals(u.getBookingEnabled()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Statie inexistenta"));
    }

    private static LocalTime open(AppUser u) {
        return u.getBookingOpen() != null ? u.getBookingOpen() : DEFAULT_OPEN;
    }

    private static LocalTime close(AppUser u) {
        return u.getBookingClose() != null ? u.getBookingClose() : DEFAULT_CLOSE;
    }

    private static List<Integer> days(AppUser u) {
        String raw = u.getBookingDays() != null && !u.getBookingDays().isBlank() ? u.getBookingDays() : DEFAULT_DAYS;
        return Arrays.stream(raw.split(",")).map(String::trim).map(Integer::valueOf).toList();
    }

    private static int capacity(AppUser u) {
        return u.getBookingCapacity() != null ? u.getBookingCapacity() : DEFAULT_CAPACITY;
    }

    // Numarul de linii ITP ale statiei
    public static int lines(AppUser u) {
        return capacity(u);
    }

    // Cate un nume pentru fiecare linie ("" = numele implicit "Linia N", pus de interfata)
    public static List<String> lineNames(AppUser u) {
        List<String> saved = u.getBookingLineNames() == null ? List.of() : List.of(u.getBookingLineNames().split("\n", -1));
        List<String> names = new ArrayList<>();
        for (int i = 0; i < capacity(u); i++) names.add(i < saved.size() ? saved.get(i).trim() : "");
        return names;
    }

    private static String formatLineNames(List<String> names, int capacity) {
        List<String> kept = names.stream().limit(capacity).map(n -> n == null ? "" : n.trim().replaceAll("\\s+", " ")).toList();
        return kept.stream().allMatch(String::isEmpty) ? null : String.join("\n", kept);
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
