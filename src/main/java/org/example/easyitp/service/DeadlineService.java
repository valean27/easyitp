package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.DeadlineReminderDTO;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.AuditEvent.Action;
import org.example.easyitp.entity.AuditEvent.EntityType;
import org.example.easyitp.entity.Client;
import org.example.easyitp.entity.DeadlineKind;
import org.example.easyitp.entity.ReminderSend;
import org.example.easyitp.entity.Vehicle;
import org.example.easyitp.entity.VehicleDeadline;
import org.example.easyitp.repository.ReminderSendRepository;
import org.example.easyitp.repository.VehicleRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

// Alte scadente ale masinii (C4): RCA, rovinieta, verificarea tahografului. Optionale, completate in formularul
// ITP sau in fisa clientului; apar in "De contactat" si, daca statia vrea, pleaca SMS automat cu 7 zile inainte.
@Service
@RequiredArgsConstructor
public class DeadlineService {

    // Fereastra din "De contactat": ca la ITP-uri (expira in 30 de zile sau a expirat de curand)
    static final int DAYS_AHEAD = 30;
    static final int DAYS_EXPIRED = 30;

    private final VehicleRepository vehicleRepository;
    private final ReminderSendRepository reminderSendRepository;
    private final AuditService auditService;

    public static Map<DeadlineKind, LocalDate> asMap(Vehicle v) {
        Map<DeadlineKind, LocalDate> map = new EnumMap<>(DeadlineKind.class);
        if (v.getDeadlines() != null) v.getDeadlines().forEach(d -> map.put(d.getKind(), d.getDueDate()));
        return map;
    }

    // Seteaza scadentele date: un tip cu null = sters, tipurile lipsa raman cum erau. O data noua uita "contactat".
    public static void apply(Vehicle v, Map<DeadlineKind, LocalDate> changes) {
        if (changes == null) return;
        changes.forEach((kind, date) -> {
            if (kind == null) return;
            validate(kind, date);
            Optional<VehicleDeadline> current = v.getDeadlines().stream().filter(d -> d.getKind() == kind).findFirst();
            if (date == null) {
                current.ifPresent(v.getDeadlines()::remove);
            } else if (current.isEmpty()) {
                v.getDeadlines().add(new VehicleDeadline(kind, date, null));
            } else if (!current.get().getDueDate().equals(date)) {
                current.get().setDueDate(date);
                current.get().setContactedAt(null);
            }
        });
    }

    // Din formularul ITP: aplica si scrie in istoric ce s-a schimbat la masina
    public void applyFromForm(AppUser user, Vehicle v, Map<DeadlineKind, LocalDate> changes) {
        if (changes == null) return;
        Map<String, String> before = AuditService.deadlineFields(v);
        apply(v, changes);
        String diff = AuditService.diff(before, AuditService.deadlineFields(v));
        if (!diff.isEmpty()) {
            vehicleRepository.save(v);
            auditService.record(user, Action.UPDATE, EntityType.VEHICLE, v.getId(), AuditService.vehicleSummary(v), diff);
        }
    }

    private static void validate(DeadlineKind kind, LocalDate date) {
        if (date == null) return;
        if (date.isBefore(LocalDate.of(2000, 1, 1)) || date.isAfter(LocalDate.now().plusYears(15))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Data pentru " + kind.label() + " nu este validă");
        }
    }

    // Scadentele de contactat ale statiei, cele mai urgente primele; fara clientii care nu vor mesaje
    @Transactional(readOnly = true)
    public List<DeadlineReminderDTO> reminders(Long userId) {
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(DAYS_EXPIRED);
        LocalDate to = today.plusDays(DAYS_AHEAD);
        List<Vehicle> vehicles = vehicleRepository.findWithDeadlinesBetween(userId, from, to).stream()
                .filter(v -> !v.getClient().declinesMessages())
                .toList();
        Map<String, LocalDateTime> autoSms = new HashMap<>();
        if (!vehicles.isEmpty()) {
            reminderSendRepository.findByVehicleIdIn(vehicles.stream().map(Vehicle::getId).toList()).stream()
                    .filter(s -> s.getStatus() == ReminderSend.Status.SENT && s.getKind() != null)
                    .forEach(s -> autoSms.put(key(s.getVehicleId(), s.getKind(), s.getDueDate()), s.getSentAt()));
        }
        return vehicles.stream()
                .flatMap(v -> v.getDeadlines().stream()
                        .filter(d -> !d.getDueDate().isBefore(from) && !d.getDueDate().isAfter(to))
                        .map(d -> {
                            Client c = v.getClient();
                            return new DeadlineReminderDTO(v.getId(), d.getKind(), d.getKind().label(), d.getDueDate(),
                                    ChronoUnit.DAYS.between(today, d.getDueDate()), c.getName(), c.getPhone(), v.getBrand(),
                                    v.getModel(), v.getLicensePlate(), c.getReminderConsent(), c.getOptOutToken(),
                                    d.getContactedAt(), autoSms.get(key(v.getId(), d.getKind(), d.getDueDate())));
                        }))
                .sorted(Comparator.comparing(DeadlineReminderDTO::dueDate))
                .toList();
    }

    // Bifa "Contactat" pentru scadenta curenta a masinii
    @Transactional
    public void setContacted(Long userId, Long vehicleId, DeadlineKind kind, boolean contacted) {
        Vehicle v = vehicleRepository.findByIdAndUserId(vehicleId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mașina nu există"));
        VehicleDeadline d = v.getDeadlines().stream().filter(x -> x.getKind() == kind).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Scadența nu există"));
        d.setContactedAt(contacted ? LocalDateTime.now() : null);
        vehicleRepository.save(v);
    }

    // Pentru precompletarea formularului ITP dupa numar
    @Transactional(readOnly = true)
    public Map<DeadlineKind, LocalDate> forPlate(Long userId, String plate) {
        return vehicleRepository.findByNormalizedPlate(PlateUtils.normalize(plate), userId).stream()
                .findFirst().map(DeadlineService::asMap).orElse(Map.of());
    }

    static String key(Long vehicleId, DeadlineKind kind, LocalDate due) {
        return vehicleId + ":" + kind + ":" + due;
    }
}
