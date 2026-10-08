package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.config.FieldException;
import org.example.easyitp.entity.Appointment;
import org.example.easyitp.entity.Notification;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.regex.Pattern;

// Ce se intampla dupa ce un client face, muta sau anuleaza o programare: SMS-ul de confirmare, emailurile (clientului
// si managerului) si notificarea din aplicatie
@Service
@RequiredArgsConstructor
public class BookingEvents {

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");

    private final AppointmentSmsService smsService;
    private final AppointmentMailService mailService;
    private final NotificationService notificationService;

    // Emailul optional al clientului: gol = null, altfel un email valid (litere mici)
    public static String optionalEmail(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String email = raw.trim().toLowerCase(Locale.ROOT);
        if (email.length() > 150 || !EMAIL.matcher(email).matches()) {
            throw new FieldException("email", "Adresa de email nu este validă (ex. nume@exemplu.ro).");
        }
        return email;
    }

    public void booked(Appointment appt) {
        smsService.sendConfirmation(appt);
        mailService.toClient(appt, AppointmentMailService.Event.BOOKED);
        mailService.toStation(appt, AppointmentMailService.Event.BOOKED);
        notify(appt, Notification.Kind.NEW_BOOKING, "Programare nouă online: " + appt.getClientName());
    }

    public void moved(Appointment appt) {
        smsService.sendConfirmation(appt);
        mailService.toClient(appt, AppointmentMailService.Event.MOVED);
        mailService.toStation(appt, AppointmentMailService.Event.MOVED);
        notify(appt, Notification.Kind.CLIENT_MOVED, appt.getClientName() + " și-a mutat programarea");
    }

    public void cancelled(Appointment appt) {
        mailService.toClient(appt, AppointmentMailService.Event.CANCELLED);
        mailService.toStation(appt, AppointmentMailService.Event.CANCELLED);
        notify(appt, Notification.Kind.CLIENT_CANCELLED, appt.getClientName() + " și-a anulat programarea");
    }

    private void notify(Appointment appt, Notification.Kind kind, String title) {
        StringBuilder body = new StringBuilder(AppointmentMailService.when(appt.getAppointmentDate()));
        if (appt.getLicensePlate() != null) body.append(" · ").append(appt.getLicensePlate());
        if (appt.getVehicleCategory() != null) body.append(" · ").append(appt.getVehicleCategory().label());
        notificationService.add(appt.getUser().getId(), kind, title, body.toString(),
                "/calendar?date=" + appt.getAppointmentDate().toLocalDate());
    }
}
