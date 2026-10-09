package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.config.FieldException;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Appointment;
import org.example.easyitp.entity.Notification;
import org.example.easyitp.repository.AppUserRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

// Ce se intampla dupa ce un client face, muta sau anuleaza o programare: SMS-ul de confirmare, emailurile (clientului
// si managerului), notificarea din aplicatie si cea push (managerului si inspectorului programarii, daca e azi sau maine)
@Service
@RequiredArgsConstructor
public class BookingEvents {

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");

    private final AppointmentSmsService smsService;
    private final AppointmentMailService mailService;
    private final NotificationService notificationService;
    private final InspectorService inspectorService;
    private final AppUserRepository appUserRepository;
    private final PushService pushService;

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
        toInspector(appt, title, body.toString());
    }

    // Inspectorul programarii (ales anume sau cel de pe linia ei in ziua aceea) afla pe telefon, daca e azi sau maine
    private void toInspector(Appointment appt, String title, String body) {
        LocalDate day = appt.getAppointmentDate().toLocalDate();
        LocalDate today = LocalDate.now();
        if (!pushService.available() || day.isBefore(today) || day.isAfter(today.plusDays(1))) return;
        Long inspectorId = appt.getInspectorId();
        if (inspectorId == null && appt.getLine() != null) {
            inspectorId = inspectorService.lineInspectors(appt.getUser(), day, day).getOrDefault(day, Map.of()).get(appt.getLine());
        }
        if (inspectorId == null) return;
        appUserRepository.findByInspectorId(inspectorId)
                .filter(AppUser::isEnabled)
                .ifPresent(account -> pushService.toAccounts(List.of(account.getId()),
                        new PushService.Message(title, (day.equals(today) ? "Azi" : "Mâine") + " · " + body, "/", "appt-" + appt.getId())));
    }
}
