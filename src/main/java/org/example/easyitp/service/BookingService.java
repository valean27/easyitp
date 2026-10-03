package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.BookingSettingsDTO;
import org.example.easyitp.dto.PublicBookingRequest;
import org.example.easyitp.dto.PublicStationDTO;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Appointment;
import org.example.easyitp.entity.AppointmentSource;
import org.example.easyitp.entity.AppointmentStatus;
import org.example.easyitp.entity.Role;
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
import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

// Programarea online de pe pagina publica a statiei (/programare/{slug})
@Service
@RequiredArgsConstructor
public class BookingService {

    public static final int MAX_DAYS_AHEAD = 30;
    // Clientul nu se poate programa cu mai putin de o ora inainte
    private static final int MIN_LEAD_MINUTES = 60;
    private static final int SLOT = AppointmentService.SLOT_MINUTES;

    private static final LocalTime DEFAULT_OPEN = LocalTime.of(8, 0);
    private static final LocalTime DEFAULT_CLOSE = LocalTime.of(17, 0);
    private static final String DEFAULT_DAYS = "1,2,3,4,5";
    private static final int DEFAULT_CAPACITY = 1;
    private static final int MAX_CAPACITY = 10;

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
                capacity(user));
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
        return getSettings(appUserRepository.save(user));
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
                MAX_DAYS_AHEAD);
    }

    public List<LocalTime> availableSlots(String slug, LocalDate date) {
        return availableSlots(findStation(slug), date, LocalDateTime.now());
    }

    List<LocalTime> availableSlots(AppUser station, LocalDate date, LocalDateTime now) {
        LocalDate today = now.toLocalDate();
        if (date.isBefore(today) || date.isAfter(today.plusDays(MAX_DAYS_AHEAD))) return List.of();
        if (!days(station).contains(date.getDayOfWeek().getValue())) return List.of();

        // Programarile active din ziua respectiva (cu o marja de un slot la capete)
        List<LocalDateTime> taken = appointmentRepository
                .findActiveBetween(station.getId(),
                        date.atTime(open(station)).minusMinutes(SLOT),
                        date.atTime(close(station)).plusMinutes(SLOT))
                .stream().map(Appointment::getAppointmentDate).toList();

        LocalDateTime earliest = now.plusMinutes(MIN_LEAD_MINUTES);
        int capacity = capacity(station);
        List<LocalTime> slots = new ArrayList<>();
        int closeMinute = close(station).toSecondOfDay() / 60;
        for (int m = open(station).toSecondOfDay() / 60; m + SLOT <= closeMinute; m += SLOT) {
            LocalTime t = LocalTime.ofSecondOfDay(m * 60L);
            LocalDateTime start = date.atTime(t);
            if (start.isBefore(earliest)) continue;
            // O programare la ora a ocupa intervalul [a, a + SLOT); se suprapune cu slotul daca a e in (start - SLOT, start + SLOT)
            long overlapping = taken.stream()
                    .filter(a -> a.isAfter(start.minusMinutes(SLOT)) && a.isBefore(start.plusMinutes(SLOT)))
                    .count();
            if (overlapping < capacity) slots.add(t);
        }
        return slots;
    }

    @Transactional
    public Appointment book(String slug, PublicBookingRequest req) {
        AppUser station = findStation(slug);

        String name = req.getClientName() == null ? "" : req.getClientName().trim();
        if (name.length() < 2 || name.length() > 80) throw badRequest("Introduceti numele");
        String phoneDigits = req.getPhone() == null ? "" : req.getPhone().replaceAll("\\D", "");
        if (phoneDigits.length() < 10 || phoneDigits.length() > 15) throw badRequest("Numar de telefon invalid");
        String plate = req.getLicensePlate() == null ? "" : req.getLicensePlate().trim().toUpperCase();
        if (plate.length() > 15) throw badRequest("Numar de inmatriculare invalid");
        if (req.getAppointmentDate() == null) throw badRequest("Alegeti data si ora");

        LocalDateTime when = req.getAppointmentDate().withSecond(0).withNano(0);
        if (!availableSlots(station, when.toLocalDate(), LocalDateTime.now()).contains(when.toLocalTime())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ora aleasa nu mai este disponibila");
        }

        return appointmentRepository.save(Appointment.builder()
                .clientName(name)
                .phone(req.getPhone().trim())
                .licensePlate(plate.isEmpty() ? null : plate)
                .appointmentDate(when)
                .status(AppointmentStatus.SCHEDULED)
                .source(AppointmentSource.ONLINE)
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

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
