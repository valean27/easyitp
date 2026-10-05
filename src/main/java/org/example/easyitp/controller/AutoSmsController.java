package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.AutoSmsSettingsDTO;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.entity.ReminderSend;
import org.example.easyitp.entity.SmsProvider;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.ItpRecordRepository;
import org.example.easyitp.repository.ReminderSendRepository;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.service.AutoReminderService;
import org.example.easyitp.service.DeliveryException;
import org.example.easyitp.service.SmsQuotaService;
import org.example.easyitp.service.SmsSender;
import org.example.easyitp.service.SmsText;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// Setarile remindere-lor SMS automate ale statiei, SMS-ul de test si jurnalul trimiterilor
@RestController
@RequestMapping("/api/account/auto-sms")
@RequiredArgsConstructor
public class AutoSmsController {

    private static final int MAX_TEMPLATE = 600;

    private final CurrentUser currentUser;
    private final AppUserRepository appUserRepository;
    private final ReminderSendRepository reminderSendRepository;
    private final ItpRecordRepository itpRecordRepository;
    private final AutoReminderService autoReminderService;
    private final SmsQuotaService smsQuotaService;

    public record LogEntryDTO(LocalDateTime sentAt, String plate, String clientName, int stage, ReminderSend.Status status,
                              String error, int attempts) {
    }

    public record TestRequest(String phone) {
    }

    @GetMapping
    public AutoSmsSettingsDTO get() {
        return toDto(currentUser.get());
    }

    @PutMapping
    public AutoSmsSettingsDTO update(@RequestBody AutoSmsSettingsDTO request) {
        AppUser user = currentUser.get();
        List<Integer> days = AutoReminderService.parseStages(request.days() == null ? null
                : request.days().stream().map(String::valueOf).collect(Collectors.joining(",")));
        if (request.template() != null && request.template().length() > MAX_TEMPLATE) throw badRequest("Textul SMS este prea lung");

        user.setAutoSmsProvider(request.provider());
        user.setAutoSmsDays(days.isEmpty() ? null : days.stream().map(String::valueOf).collect(Collectors.joining(",")));
        String template = request.template() == null ? null : request.template().trim();
        user.setAutoSmsTemplate(template == null || template.isEmpty() || template.equals(SmsText.DEFAULT_TEMPLATE) ? null : template);
        user.setSmsGateUsername(trimToNull(request.smsGateUsername()));
        if (trimToNull(request.smsGatePassword()) != null) user.setSmsGatePassword(request.smsGatePassword().trim());
        user.setSmslinkConnectionId(trimToNull(request.smslinkConnectionId()));
        if (trimToNull(request.smslinkPassword()) != null) user.setSmslinkPassword(request.smslinkPassword().trim());
        // Server SMS Gateway propriu (optional): doar https cu nume de domeniu
        String url = trimToNull(request.smsGateUrl());
        try {
            user.setSmsGateUrl(url == null ? null : SmsSender.validSmsGateUrl(url));
        } catch (DeliveryException e) {
            throw badRequest(e.getMessage());
        }

        if (request.provider() == SmsProvider.PLATFORM && (request.enabled() || request.apptConfirmSms() || request.apptReminderSms())) {
            if (!smsQuotaService.platformAvailable()) throw badRequest("SMS-urile incluse în abonament nu sunt disponibile momentan.");
            if (SmsQuotaService.plan(user) <= 0) {
                throw badRequest("Stația nu are încă un pachet de SMS. Contactați-ne ca să alegeți unul.");
            }
        }
        if (request.enabled()) {
            if (request.provider() == null) throw badRequest("Alegeți cum se trimit SMS-urile.");
            if (request.provider() == SmsProvider.SMS_GATE && (user.getSmsGateUsername() == null || user.getSmsGatePassword() == null)) {
                throw badRequest("Introduceți utilizatorul și parola din aplicația SMS Gateway (secțiunea Cloud Server).");
            }
            if (request.provider() == SmsProvider.SMSLINK && (user.getSmslinkConnectionId() == null || user.getSmslinkPassword() == null)) {
                throw badRequest("Introduceți Connection ID și parola conexiunii SMSLink.");
            }
        }
        if ((request.apptConfirmSms() || request.apptReminderSms()) && !configuredFor(user, request.provider())) {
            throw badRequest("Pentru SMS-urile de programare alegeți întâi cum se trimit SMS-urile și completați datele.");
        }
        user.setAutoSmsEnabled(request.enabled());
        user.setApptConfirmSms(request.apptConfirmSms());
        user.setApptReminderSms(request.apptReminderSms());
        return toDto(appUserRepository.save(user));
    }

    // Trimite acum un SMS de proba (implicit pe telefonul statiei); mesajul de eroare ajunge in interfata
    @PostMapping("/test")
    public ResponseEntity<Map<String, String>> test(@RequestBody(required = false) TestRequest request) {
        AppUser user = currentUser.get();
        String phone = request != null && trimToNull(request.phone()) != null ? request.phone().trim() : user.getPhone();
        if (phone == null) throw badRequest("Introduceți numărul pe care vreți SMS-ul de test.");
        try {
            String text = autoReminderService.sendTest(user, phone);
            return ResponseEntity.ok(Map.of("message", "SMS-ul de test a plecat spre " + phone + ".", "text", text));
        } catch (DeliveryException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("message", e.getMessage()));
        }
    }

    // Ultimele trimiteri, cele mai noi primele
    @GetMapping("/log")
    @Transactional(readOnly = true)
    public List<LogEntryDTO> log() {
        AppUser user = currentUser.get();
        List<ReminderSend> sends = reminderSendRepository.findByUserIdOrderBySentAtDesc(user.getId(), PageRequest.of(0, 100));
        Map<Long, ItpRecord> records = new HashMap<>();
        itpRecordRepository.findAllById(sends.stream().map(ReminderSend::getItpRecordId).toList())
                .forEach(r -> records.put(r.getId(), r));
        return sends.stream().map(s -> {
            ItpRecord r = records.get(s.getItpRecordId());
            return new LogEntryDTO(s.getSentAt(), r == null ? null : r.getVehicle().getLicensePlate().toUpperCase(),
                    r == null ? null : r.getVehicle().getClient().getName(), s.getStage(), s.getStatus(), s.getError(),
                    s.getAttempts());
        }).toList();
    }

    private AutoSmsSettingsDTO toDto(AppUser u) {
        long sent = reminderSendRepository.countByUserIdAndStatusAndSentAtAfter(u.getId(), ReminderSend.Status.SENT,
                LocalDate.now().minusDays(30).atStartOfDay());
        return new AutoSmsSettingsDTO(Boolean.TRUE.equals(u.getAutoSmsEnabled()), u.getAutoSmsProvider(),
                AutoReminderService.stages(u), u.getAutoSmsTemplate() != null ? u.getAutoSmsTemplate() : SmsText.DEFAULT_TEMPLATE,
                SmsText.DEFAULT_TEMPLATE, u.getSmsGateUrl(), u.getSmsGateUsername(), null, u.getSmsGatePassword() != null,
                u.getSmslinkConnectionId(), null, u.getSmslinkPassword() != null, sent,
                Boolean.TRUE.equals(u.getApptConfirmSms()), Boolean.TRUE.equals(u.getApptReminderSms()),
                smsQuotaService.platformAvailable(), SmsQuotaService.plan(u), smsQuotaService.usedThisMonth(u.getId()));
    }

    private boolean configuredFor(AppUser u, SmsProvider provider) {
        if (provider == SmsProvider.PLATFORM) return smsQuotaService.platformAvailable() && SmsQuotaService.plan(u) > 0;
        if (provider == SmsProvider.SMS_GATE) return u.getSmsGateUsername() != null && u.getSmsGatePassword() != null;
        if (provider == SmsProvider.SMSLINK) return u.getSmslinkConnectionId() != null && u.getSmslinkPassword() != null;
        return false;
    }

    private static String trimToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
