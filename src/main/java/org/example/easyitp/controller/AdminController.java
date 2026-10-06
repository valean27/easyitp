package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.CreateUserRequest;
import org.example.easyitp.dto.ManagerSummaryDTO;
import org.example.easyitp.dto.StationInfoDTO;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.AuditEventRepository;
import org.example.easyitp.repository.ReminderSendRepository;
import org.example.easyitp.repository.SmsUsageRepository;
import org.example.easyitp.service.SmsQuotaService;
import org.example.easyitp.service.BillingService;
import org.example.easyitp.service.Plans;
import org.example.easyitp.repository.FleetRepository;
import org.example.easyitp.repository.AppointmentRepository;
import org.example.easyitp.repository.ClientRepository;
import org.example.easyitp.service.ItpService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private static final int EXPIRING_SOON_DAYS = 30;
    private static final int MIN_PASSWORD_LENGTH = 6;

    private final AppUserRepository appUserRepository;
    private final FleetRepository fleetRepository;
    private final ItpService itpService;
    private final AppointmentRepository appointmentRepository;
    private final ClientRepository clientRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditEventRepository auditEventRepository;
    private final ReminderSendRepository reminderSendRepository;
    private final SmsUsageRepository smsUsageRepository;
    private final org.example.easyitp.repository.StationDeadlineRepository stationDeadlineRepository;
    private final org.example.easyitp.repository.InvoiceRepository invoiceRepository;
    private final org.example.easyitp.repository.PaymentRepository paymentRepository;
    private final BillingService billingService;
    private final org.example.easyitp.repository.AuthTokenRepository authTokenRepository;

    @PostMapping("/create-user")
    public ResponseEntity<Void> createUser(@RequestBody CreateUserRequest request) {
        if (request.getEmail() == null || request.getEmail().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email obligatoriu");
        }
        validatePassword(request.getPassword());
        String email = request.getEmail().trim().toLowerCase(Locale.ROOT);
        if (appUserRepository.existsByEmailIgnoreCase(email)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
        AppUser user = AppUser.builder()
                .email(email)
                .password(passwordEncoder.encode(request.getPassword()))
                .role(Role.MANAGER)
                .stationName(trimToNull(request.getStationName()))
                .address(trimToNull(request.getAddress()))
                .phone(trimToNull(request.getPhone()))
                .build();
        BillingService.startTrial(user, LocalDate.now());
        appUserRepository.save(user);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    // Doar cifre agregate per statie; adminul nu vede clientii managerilor
    @GetMapping("/managers")
    public List<ManagerSummaryDTO> getManagers() {
        LocalDate monthStart = LocalDate.now().withDayOfMonth(1);
        Map<Long, ItpService.StationStats> itpStats = itpService.stationStats(EXPIRING_SOON_DAYS);
        Map<Long, Long> appointments = new HashMap<>();
        for (Object[] row : appointmentRepository.countByUserBetween(
                monthStart.atStartOfDay(), monthStart.plusMonths(1).atStartOfDay())) {
            appointments.put((Long) row[0], (Long) row[1]);
        }

        Map<Long, Integer> smsUsed = new HashMap<>();
        smsUsageRepository.findByMonth(java.time.YearMonth.now().toString()).forEach(s -> smsUsed.put(s.getUserId(), s.getSent()));

        return appUserRepository.findByRoleOrderByIdAsc(Role.MANAGER).stream()
                .map(u -> {
                    ItpService.StationStats s = itpStats.getOrDefault(u.getId(), new ItpService.StationStats());
                    return ManagerSummaryDTO.builder()
                            .id(u.getId())
                            .email(u.getEmail())
                            .stationName(u.getStationName())
                            .address(u.getAddress())
                            .phone(u.getPhone())
                            .active(u.isEnabled())
                            .createdAt(u.getCreatedAt())
                            .lastLoginAt(u.getLastLoginAt())
                            .itpCount(s.total)
                            .expiredCount(s.expired)
                            .expiringSoonCount(s.expiringSoon)
                            .itpThisMonth(s.thisMonth)
                            .revenueThisMonth(s.revenueThisMonth)
                            .appointmentsThisMonth(appointments.getOrDefault(u.getId(), 0L))
                            .smsPlan(SmsQuotaService.plan(u))
                            .smsUsedThisMonth(smsUsed.getOrDefault(u.getId(), 0))
                            .plan(Plans.effective(u).name())
                            .paidPlan(u.getPlan() == null ? null : u.getPlan().name())
                            .planUntil(u.getPlanUntil())
                            .planTrial(Plans.onTrial(u, LocalDate.now()))
                            .build();
                })
                .toList();
    }

    @PutMapping("/managers/{id}")
    public ResponseEntity<Void> updateManager(@PathVariable Long id, @RequestBody StationInfoDTO request) {
        AppUser user = findManager(id);
        user.setStationName(trimToNull(request.getStationName()));
        user.setAddress(trimToNull(request.getAddress()));
        user.setPhone(trimToNull(request.getPhone()));
        appUserRepository.save(user);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/managers/{id}/reset-password")
    public ResponseEntity<Void> resetPassword(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String password = body.get("password");
        validatePassword(password);
        AppUser user = findManager(id);
        user.setPassword(passwordEncoder.encode(password));
        user.revokeTokens();
        appUserRepository.save(user);
        return ResponseEntity.noContent().build();
    }

    // Pachetul de SMS inclus in abonament (0 / 300 / 600 / 1000 pe luna)
    @PutMapping("/managers/{id}/sms-plan")
    public ResponseEntity<Void> setSmsPlan(@PathVariable Long id, @RequestBody Map<String, Integer> body) {
        Integer plan = body.get("plan");
        if (!SmsQuotaService.validPlan(plan)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pachet SMS invalid");
        AppUser user = findManager(id);
        user.setSmsPlan(plan);
        appUserRepository.save(user);
        return ResponseEntity.noContent().build();
    }

    // Abonament dat de admin (ex. platit prin transfer bancar): pachetul si ultima zi platita (gol = fara expirare)
    public record PlanRequest(String plan, LocalDate until) {
    }

    @PutMapping("/managers/{id}/plan")
    public ResponseEntity<Void> setPlan(@PathVariable Long id, @RequestBody PlanRequest body) {
        billingService.grant(findManager(id), BillingService.parsePlan(body.plan()), body.until());
        return ResponseEntity.noContent().build();
    }

    // Platile tuturor statiilor (abonamentele platformei)
    @GetMapping("/payments")
    public List<Map<String, Object>> payments() {
        Map<Long, String> names = new HashMap<>();
        appUserRepository.findByRoleOrderByIdAsc(Role.MANAGER).forEach(u -> names.put(u.getId(),
                u.getStationName() != null ? u.getStationName() : u.getEmail()));
        return paymentRepository.findAllByOrderByCreatedAtDesc(org.springframework.data.domain.PageRequest.of(0, 300)).stream()
                .map(p -> {
                    Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("station", names.getOrDefault(p.getUserId(), "#" + p.getUserId()));
                    m.put("payment", BillingService.dto(p));
                    m.put("invoiceError", p.getInvoiceError());
                    return m;
                })
                .toList();
    }

    @PutMapping("/managers/{id}/active")
    public ResponseEntity<Void> setActive(@PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        AppUser user = findManager(id);
        user.setActive(Boolean.TRUE.equals(body.get("active")));
        if (!user.isEnabled()) user.revokeTokens();
        appUserRepository.save(user);
        return ResponseEntity.noContent().build();
    }

    // Stergem doar conturi fara date; pentru statiile cu istoric se foloseste dezactivarea
    @DeleteMapping("/managers/{id}")
    public ResponseEntity<Void> deleteManager(@PathVariable Long id) {
        AppUser user = findManager(id);
        if (clientRepository.existsByUserId(id) || appointmentRepository.existsByUserId(id)
                || fleetRepository.existsByStationId(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Managerul are date; dezactivati contul");
        }
        auditEventRepository.deleteByUserId(id);
        reminderSendRepository.deleteByUserId(id);
        stationDeadlineRepository.deleteByUserId(id);
        invoiceRepository.deleteByUserId(id);
        paymentRepository.deleteByUserId(id);
        authTokenRepository.deleteByUserId(id);
        appUserRepository.delete(user);
        return ResponseEntity.noContent().build();
    }

    private AppUser findManager(Long id) {
        return appUserRepository.findById(id)
                .filter(u -> u.getRole() == Role.MANAGER)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Manager inexistent"));
    }

    private void validatePassword(String password) {
        if (password == null || password.length() < MIN_PASSWORD_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Parola trebuie sa aiba minim " + MIN_PASSWORD_LENGTH + " caractere");
        }
    }

    private static String trimToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
