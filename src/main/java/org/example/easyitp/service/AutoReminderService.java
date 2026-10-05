package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Appointment;
import org.example.easyitp.entity.AppointmentStatus;
import org.example.easyitp.entity.Client;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.entity.ReminderConsent;
import org.example.easyitp.entity.ReminderSend;
import org.example.easyitp.entity.ReminderStatus;
import org.example.easyitp.entity.Role;
import org.example.easyitp.entity.SmsProvider;
import org.example.easyitp.entity.Vehicle;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.AppointmentRepository;
import org.example.easyitp.repository.ItpRecordRepository;
import org.example.easyitp.repository.ReminderSendRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

// Remindere SMS automate: la rularea zilnica, fiecare statie cu SMS-urile pornite trimite un mesaj clientilor al
// caror ITP expira peste 30 / 7 zile (treptele alese de statie). Doar clientilor care si-au dat acordul (C1),
// o singura data pe ITP si pe treapta, cu o limita zilnica de siguranta.
@Service
@RequiredArgsConstructor
@Slf4j
public class AutoReminderService {

    public static final List<Integer> DEFAULT_STAGES = List.of(30, 7);
    public static final Set<Integer> ALLOWED_STAGES = Set.of(60, 45, 30, 21, 14, 7, 3, 1);
    // Cate zile dupa o treapta mai trimitem (rularea zilnica a picat o zi, sau SMS-urile tocmai au fost pornite)
    static final int CATCH_UP_DAYS = 5;
    static final int MAX_ATTEMPTS = 3;
    static final int MAX_PER_STATION_PER_DAY = 300;

    private final AppUserRepository appUserRepository;
    private final ItpRecordRepository itpRecordRepository;
    private final ReminderSendRepository reminderSendRepository;
    private final AppointmentRepository appointmentRepository;
    private final SmsSender smsSender;

    @Value("${app.url:https://easyitp.vercel.app}")
    private String appUrl;

    public record RunResult(int sent, int failed, int skipped) {
    }

    // Apelat de rularea zilnica (POST /api/internal/daily-digest)
    public RunResult runDaily(LocalDate today) {
        int sent = 0, failed = 0, skipped = 0;
        for (AppUser station : appUserRepository.findByRoleOrderByIdAsc(Role.MANAGER)) {
            if (!station.isEnabled() || !Boolean.TRUE.equals(station.getAutoSmsEnabled()) || station.getAutoSmsProvider() == null) {
                continue;
            }
            RunResult r = runStation(station, today);
            sent += r.sent();
            failed += r.failed();
            skipped += r.skipped();
        }
        log.info("SMS automate {}: {} trimise, {} esuate, {} sarite", today, sent, failed, skipped);
        return new RunResult(sent, failed, skipped);
    }

    RunResult runStation(AppUser station, LocalDate today) {
        List<Integer> stages = stages(station);
        int sent = 0, failed = 0, skipped = 0;
        long sentToday = reminderSendRepository.countByUserIdAndStatusAndSentAtAfter(
                station.getId(), ReminderSend.Status.SENT, today.atStartOfDay());
        Set<String> bookedPlates = upcomingBookedPlates(station, today);

        List<ItpRecord> candidates = itpRecordRepository.findLatestExpiringBetween(station.getId(), today,
                today.plusDays(stages.get(0)));
        for (ItpRecord r : candidates) {
            long daysLeft = ChronoUnit.DAYS.between(today, r.getNextItpDate());
            Integer stage = stageFor(daysLeft, stages);
            Client client = r.getVehicle().getClient();
            if (stage == null || client.getReminderConsent() != ReminderConsent.GIVEN
                    || r.getReminderStatus() == ReminderStatus.SCHEDULED || r.getReminderStatus() == ReminderStatus.NOT_INTERESTED
                    || bookedPlates.contains(r.getVehicle().getNormalizedPlate())
                    || SmsSender.phoneDigits(client.getPhone()) == null) {
                continue;
            }
            ReminderSend previous = reminderSendRepository.findByItpRecordIdAndStage(r.getId(), stage).orElse(null);
            if (previous != null && (previous.getStatus() == ReminderSend.Status.SENT || previous.getAttempts() >= MAX_ATTEMPTS)) {
                continue;
            }
            if (sentToday >= MAX_PER_STATION_PER_DAY) {
                skipped++;
                continue;
            }
            if (deliver(station, r, stage, previous)) {
                sent++;
                sentToday++;
            } else {
                failed++;
            }
        }
        return new RunResult(sent, failed, skipped);
    }

    // Treapta in care intra un ITP: cea mai mica treapta >= zilele ramase, daca nu au trecut prea multe zile de la ea
    // (ex. cu treptele 30 si 7: 30..25 zile -> 30, 7..2 zile -> 7, 20 de zile -> nimic)
    static Integer stageFor(long daysLeft, List<Integer> stagesDesc) {
        if (daysLeft < 0) return null;
        Integer match = null;
        for (int stage : stagesDesc) {
            if (daysLeft <= stage) match = stage;
        }
        return match == null || daysLeft < match - CATCH_UP_DAYS ? null : match;
    }

    private boolean deliver(AppUser station, ItpRecord record, int stage, ReminderSend previous) {
        Client client = record.getVehicle().getClient();
        String text = SmsText.render(station.getAutoSmsTemplate(), messageData(station, record));
        ReminderSend send = previous != null ? previous : ReminderSend.builder()
                .userId(station.getId()).itpRecordId(record.getId()).stage(stage).attempts(0).build();
        send.setPhone(client.getPhone());
        send.setProvider(station.getAutoSmsProvider());
        send.setAttempts(send.getAttempts() + 1);
        send.setSentAt(LocalDateTime.now());
        try {
            send.setMessageId(truncate(smsSender.send(station, client.getPhone(), text), 100));
            send.setStatus(ReminderSend.Status.SENT);
            send.setError(null);
        } catch (DeliveryException e) {
            send.setStatus(ReminderSend.Status.FAILED);
            send.setError(truncate(e.getMessage(), 300));
        }
        reminderSendRepository.save(send);
        return send.getStatus() == ReminderSend.Status.SENT;
    }

    SmsText.Data messageData(AppUser station, ItpRecord record) {
        Vehicle v = record.getVehicle();
        Client c = v.getClient();
        String booking = Boolean.TRUE.equals(station.getBookingEnabled()) && station.getBookingSlug() != null
                ? appUrl + "/programare/" + station.getBookingSlug() : null;
        return new SmsText.Data(c.getName(), v.getLicensePlate().toUpperCase(), joinCar(v),
                record.getNextItpDate(), record.getNextItpDate().isBefore(LocalDate.now()),
                station.getStationName(), station.getAddress(), station.getPhone(), booking,
                c.getOptOutToken() == null ? null : appUrl + "/s/" + c.getOptOutToken());
    }

    // SMS de proba catre un numar dat (de obicei telefonul managerului), cu date de exemplu
    public String sendTest(AppUser station, String phone) {
        String booking = Boolean.TRUE.equals(station.getBookingEnabled()) && station.getBookingSlug() != null
                ? appUrl + "/programare/" + station.getBookingSlug() : null;
        String text = SmsText.render(station.getAutoSmsTemplate(), new SmsText.Data("Ion Popescu", "CJ 01 ABC",
                "Dacia Logan", LocalDate.now().plusDays(stages(station).get(0)), false, station.getStationName(),
                station.getAddress(), station.getPhone(), booking, appUrl + "/s/exemplu"));
        smsSender.send(station, phone, "[Test] " + text);
        return text;
    }

    // Numerele cu o programare viitoare: nu le mai trimitem reminder (clientul vine deja)
    private Set<String> upcomingBookedPlates(AppUser station, LocalDate today) {
        return appointmentRepository.findByUserIdAndAppointmentDateBetweenOrderByAppointmentDateAsc(
                        station.getId(), today.atStartOfDay(), today.plusDays(90).atStartOfDay()).stream()
                .filter(a -> a.getStatus() == AppointmentStatus.SCHEDULED && a.getLicensePlate() != null)
                .map(Appointment::getLicensePlate)
                .map(PlateUtils::normalize)
                .collect(Collectors.toSet());
    }

    // Treptele statiei, descrescator (ex. [30, 7])
    public static List<Integer> stages(AppUser station) {
        List<Integer> parsed = parseStages(station.getAutoSmsDays());
        return parsed.isEmpty() ? DEFAULT_STAGES : parsed;
    }

    public static List<Integer> parseStages(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> s.matches("\\d{1,2}"))
                .map(Integer::valueOf)
                .filter(ALLOWED_STAGES::contains)
                .distinct()
                .sorted(Comparator.reverseOrder())
                .toList();
    }

    private static String joinCar(Vehicle v) {
        return v.getModel() == null ? v.getBrand() : v.getBrand() + " " + v.getModel();
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    static boolean configured(AppUser s) {
        return s.getAutoSmsProvider() == SmsProvider.SMS_GATE
                ? notBlank(s.getSmsGateUsername()) && notBlank(s.getSmsGatePassword())
                : s.getAutoSmsProvider() == SmsProvider.SMSLINK && notBlank(s.getSmslinkConnectionId()) && notBlank(s.getSmslinkPassword());
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
