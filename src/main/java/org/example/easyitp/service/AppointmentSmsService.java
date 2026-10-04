package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Appointment;
import org.example.easyitp.entity.AppointmentStatus;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.AppointmentRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

// SMS-uri despre o programare, pe canalul SMS al statiei (vezi SmsSender): confirmarea imediat dupa programarea
// online si reminderul in dimineata dinaintea programarii. Sunt mesaje despre o programare facuta chiar de client,
// deci nu cer acordul pentru remindere ITP; contin link-ul de anulare / mutare.
@Service
@RequiredArgsConstructor
@Slf4j
public class AppointmentSmsService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd.MM");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");
    private static final String[] DAYS = {"luni", "marti", "miercuri", "joi", "vineri", "sambata", "duminica"};

    private final AppUserRepository appUserRepository;
    private final AppointmentRepository appointmentRepository;
    private final SmsSender smsSender;

    @Value("${app.url:https://easyitp.vercel.app}")
    private String appUrl;

    public record RunResult(int sent, int failed) {
    }

    // Dupa programarea online; o eroare de trimitere nu strica programarea
    public void sendConfirmation(Appointment appt) {
        AppUser station = appt.getUser();
        if (!Boolean.TRUE.equals(station.getApptConfirmSms()) || !canSend(station, appt)) return;
        try {
            smsSender.send(station, appt.getPhone(), confirmationText(station, appt));
            appt.setConfirmationSentAt(LocalDateTime.now());
            appointmentRepository.save(appt);
        } catch (DeliveryException e) {
            log.warn("Confirmarea programarii {} nu a plecat: {}", appt.getId(), e.getMessage());
        }
    }

    // Rularea de dimineata: programarile de maine (sambata si cele de luni, pentru ca duminica nu ruleaza)
    public RunResult runDayBefore(LocalDate today) {
        LocalDate until = today.getDayOfWeek() == DayOfWeek.SATURDAY ? today.plusDays(2) : today.plusDays(1);
        int sent = 0, failed = 0;
        for (AppUser station : appUserRepository.findByRoleOrderByIdAsc(Role.MANAGER)) {
            if (!station.isEnabled() || !Boolean.TRUE.equals(station.getApptReminderSms()) || station.getAutoSmsProvider() == null) {
                continue;
            }
            for (Appointment appt : appointmentRepository.findByUserIdAndAppointmentDateBetweenOrderByAppointmentDateAsc(
                    station.getId(), today.plusDays(1).atStartOfDay(), until.plusDays(1).atStartOfDay())) {
                if (appt.getStatus() != AppointmentStatus.SCHEDULED || appt.getReminderSentAt() != null || !canSend(station, appt)) {
                    continue;
                }
                try {
                    smsSender.send(station, appt.getPhone(), reminderText(station, appt));
                    appt.setReminderSentAt(LocalDateTime.now());
                    appointmentRepository.save(appt);
                    sent++;
                } catch (DeliveryException e) {
                    log.warn("Reminderul programarii {} nu a plecat: {}", appt.getId(), e.getMessage());
                    failed++;
                }
            }
        }
        log.info("Remindere programari {}: {} trimise, {} esuate", today, sent, failed);
        return new RunResult(sent, failed);
    }

    private boolean canSend(AppUser station, Appointment appt) {
        return station.getAutoSmsProvider() != null && SmsSender.phoneDigits(appt.getPhone()) != null;
    }

    String confirmationText(AppUser station, Appointment appt) {
        return SmsText.plain(stationName(station) + ": programare ITP confirmata " + when(appt)
                + plate(appt) + ". Anulare sau alta ora: " + manageLink(appt));
    }

    String reminderText(AppUser station, Appointment appt) {
        String address = station.getAddress() == null ? "" : " Adresa: " + station.getAddress().trim() + ".";
        return SmsText.plain(stationName(station) + ": va asteptam la ITP " + when(appt) + plate(appt) + "." + address
                + " Anulare sau alta ora: " + manageLink(appt));
    }

    public String manageLink(Appointment appt) {
        return appUrl + "/p/" + appt.getManageToken();
    }

    // "joi 12.11, ora 10:20"
    private static String when(Appointment appt) {
        LocalDateTime d = appt.getAppointmentDate();
        return DAYS[d.getDayOfWeek().getValue() - 1] + " " + d.format(DATE) + ", ora " + d.format(TIME);
    }

    private static String plate(Appointment appt) {
        return appt.getLicensePlate() == null || appt.getLicensePlate().isBlank() ? ""
                : " pentru " + appt.getLicensePlate().trim().toUpperCase(Locale.ROOT);
    }

    private static String stationName(AppUser station) {
        return station.getStationName() != null ? station.getStationName() : "Statia ITP";
    }
}
