package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Appointment;
import org.example.easyitp.entity.AppointmentStatus;
import org.example.easyitp.entity.VehicleCategory;
import org.example.easyitp.repository.AppointmentRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

// Link-ul clientului din SMS (/p/{token}, fara login): isi vede programarea, o anuleaza sau o muta pe alta ora libera
@Service
@RequiredArgsConstructor
public class AppointmentSelfService {

    // Cu cel putin o ora inainte se mai poate anula sau muta; dupa aceea, doar telefonic
    static final int MIN_MINUTES_BEFORE = 60;

    private final AppointmentRepository appointmentRepository;
    private final BookingService bookingService;
    private final BookingEvents bookingEvents;
    private final AppointmentMailService appointmentMailService;
    private final AppointmentSmsService appointmentSmsService;

    public record ManageView(String stationName, String address, String phone, String slug, LocalDateTime appointmentDate,
                             String licensePlate, String vehicleLabel, VehicleCategory vehicleCategory,
                             AppointmentStatus status, boolean canChange, String clientAction,
                             // pentru calendarul clientului; null cand programarea nu mai e activa
                             String googleCalendarUrl, String icsUrl) {
    }

    @Transactional(readOnly = true)
    public ManageView view(String token) {
        return toView(find(token));
    }

    @Transactional
    public ManageView cancel(String token) {
        Appointment appt = changeable(find(token));
        appt.setStatus(AppointmentStatus.CANCELLED);
        appt.setClientAction("CANCELLED");
        appt.setClientActionAt(LocalDateTime.now());
        Appointment saved = appointmentRepository.save(appt);
        bookingEvents.cancelled(saved);
        return toView(saved);
    }

    @Transactional(readOnly = true)
    public List<LocalTime> slots(String token, LocalDate date) {
        Appointment appt = changeable(find(token));
        return bookingService.availableSlots(appt.getUser(), date, category(appt), LocalDateTime.now(), appt.getId());
    }

    // Mutarea pe alta ora: doar pe o ora libera pentru tipul vehiculului (fara programarea insasi)
    @Transactional
    public ManageView reschedule(String token, LocalDateTime when) {
        Appointment appt = changeable(find(token));
        if (when == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Alegeți ziua și ora");
        LocalDateTime start = when.withSecond(0).withNano(0);
        List<LocalTime> free = bookingService.availableSlots(appt.getUser(), start.toLocalDate(), category(appt),
                LocalDateTime.now(), appt.getId());
        if (!free.contains(start.toLocalTime())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ora aleasă nu mai este liberă. Alegeți alta.");
        }
        appt.setLine(bookingService.pickLine(appt.getUser(), start, InspectionDurations.minutesOf(appt), appt.getId(), appt.getLine()));
        appt.setAppointmentDate(start);
        appt.setClientAction("RESCHEDULED");
        appt.setClientActionAt(LocalDateTime.now());
        // reminderul de dinainte se trimite din nou pentru noua data, iar confirmarea pleaca acum
        appt.setReminderSentAt(null);
        Appointment saved = appointmentRepository.save(appt);
        bookingEvents.moved(saved);
        return toView(saved);
    }

    @Transactional(readOnly = true)
    public String calendar(String token) {
        Appointment appt = find(token);
        if (appt.getStatus() == AppointmentStatus.CANCELLED) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Programarea este anulată");
        return CalendarLinks.ics(appt, appt.getUser(), appointmentSmsService.manageLink(appt));
    }

    private Appointment find(String token) {
        if (token == null || token.length() < 10 || token.length() > 40) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Programare inexistentă");
        }
        return appointmentRepository.findByManageToken(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Programare inexistentă"));
    }

    private static Appointment changeable(Appointment appt) {
        if (!canChange(appt)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Programarea nu mai poate fi schimbată online. Sunați la stație.");
        }
        return appt;
    }

    static boolean canChange(Appointment appt) {
        return appt.getStatus() == AppointmentStatus.SCHEDULED
                && appt.getAppointmentDate().isAfter(LocalDateTime.now().plusMinutes(MIN_MINUTES_BEFORE));
    }

    private static VehicleCategory category(Appointment appt) {
        return appt.getVehicleCategory() != null ? appt.getVehicleCategory() : VehicleCategory.CAR;
    }

    private ManageView toView(Appointment appt) {
        AppUser s = appt.getUser();
        VehicleCategory category = category(appt);
        String slug = Boolean.TRUE.equals(s.getBookingEnabled()) ? s.getBookingSlug() : null;
        return new ManageView(s.getStationName() != null ? s.getStationName() : "Stație ITP", s.getAddress(), s.getPhone(),
                slug, appt.getAppointmentDate(), appt.getLicensePlate(), category.label(), category,
                appt.getStatus(), canChange(appt), appt.getClientAction(),
                appt.getStatus() == AppointmentStatus.SCHEDULED ? CalendarLinks.google(appt, s, appointmentSmsService.manageLink(appt)) : null,
                appt.getStatus() == AppointmentStatus.SCHEDULED ? appointmentMailService.icsLink(appt) : null);
    }
}
