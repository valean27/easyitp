package org.example.easyitp.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.AuditEvent;
import org.example.easyitp.entity.AuditEvent.Action;
import org.example.easyitp.entity.AuditEvent.EntityType;
import org.example.easyitp.entity.Client;
import org.example.easyitp.entity.DeadlineKind;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.entity.ItpStatus;
import org.example.easyitp.entity.ReminderConsent;
import org.example.easyitp.entity.ReminderStatus;
import org.example.easyitp.entity.Vehicle;
import org.example.easyitp.repository.AuditEventRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

// Istoricul modificarilor: fiecare adaugare/modificare/stergere a unui ITP, client sau masina devine o intrare.
// Stergerile pastreaza datele (snapshot JSON), ca sa poata fi anulate (HistoryService.undo).
@Service
@RequiredArgsConstructor
public class AuditService {

    private static final DateTimeFormatter RO_DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final int MAX_SUMMARY = 300;

    private final AuditEventRepository auditEventRepository;
    private final ObjectMapper objectMapper;

    // ---------- datele sterse ----------

    public record ItpSnap(LocalDate testDate, Integer validityMonths, LocalDate nextItpDate, ItpStatus status, Integer mileage,
                          Double price, String observations, String inspector, ReminderStatus reminderStatus,
                          LocalDateTime reminderAt, List<Long> appointmentIds) {
    }

    // deadlines lipseste din stergerile de dinainte de C4 -> null
    public record VehicleSnap(String licensePlate, String brand, String model, Integer year, String vin, List<ItpSnap> itps,
                              Map<DeadlineKind, LocalDate> deadlines) {
    }

    // consent*: acordul pentru remindere (lipsesc din stergerile de dinainte de C1 -> null)
    public record ClientSnap(String name, String phone, List<VehicleSnap> vehicles, ReminderConsent consent,
                             LocalDateTime consentAt, String consentSource) {
    }

    public static ItpSnap snap(ItpRecord r, List<Long> appointmentIds) {
        return new ItpSnap(r.getTestDate(), r.getValidityMonths(), r.getNextItpDate(), r.getStatus(), r.getMileage(),
                r.getPrice(), r.getObservations(), r.getInspector(), r.getReminderStatus(), r.getReminderAt(), appointmentIds);
    }

    public static VehicleSnap snap(Vehicle v, List<ItpSnap> itps) {
        return new VehicleSnap(v.getLicensePlate(), v.getBrand(), v.getModel(), v.getYear(), v.getVin(), itps,
                DeadlineService.asMap(v));
    }

    public ClientSnap readSnapshot(AuditEvent event) {
        try {
            return objectMapper.readValue(event.getSnapshot(), ClientSnap.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Snapshot invalid pentru evenimentul " + event.getId(), e);
        }
    }

    // ---------- inregistrare ----------

    public Long record(AppUser user, Action action, EntityType type, Long entityId, String summary, String changes) {
        return save(user, user.getEmail(), action, type, entityId, summary, changes, null);
    }

    // Modificare facuta de altcineva decat contul statiei (ex. clientul, din link-ul STOP)
    public Long recordAs(AppUser station, String actor, Action action, EntityType type, Long entityId, String summary,
                         String changes) {
        return save(station, actor, action, type, entityId, summary, changes, null);
    }

    public Long recordDeletion(AppUser user, EntityType type, Long entityId, String summary, ClientSnap snapshot) {
        try {
            return save(user, user.getEmail(), Action.DELETE, type, entityId, summary, null, objectMapper.writeValueAsString(snapshot));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Datele sterse nu au putut fi salvate", e);
        }
    }

    private Long save(AppUser user, String actor, Action action, EntityType type, Long entityId, String summary, String changes,
                      String snapshot) {
        String text = summary.length() > MAX_SUMMARY ? summary.substring(0, MAX_SUMMARY - 1) + "…" : summary;
        return auditEventRepository.save(AuditEvent.builder()
                .userId(user.getId())
                .actor(actor)
                .createdAt(LocalDateTime.now())
                .action(action)
                .entityType(type)
                .entityId(entityId)
                .summary(text)
                .changes(changes == null || changes.isBlank() ? null : changes)
                .snapshot(snapshot)
                .build()).getId();
    }

    // ---------- texte ----------

    public static String itpSummary(ItpRecord r) {
        Vehicle v = r.getVehicle();
        return v.getLicensePlate().toUpperCase() + " · " + v.getClient().getName() + " · ITP " + r.getTestDate().format(RO_DATE);
    }

    public static String vehicleSummary(Vehicle v) {
        return v.getLicensePlate().toUpperCase() + " · " + v.getBrand() + (v.getModel() != null ? " " + v.getModel() : "")
                + " · " + v.getClient().getName();
    }

    public static String clientSummary(Client c) {
        return c.getName() + (c.getPhone() != null ? " · " + c.getPhone() : "");
    }

    // Campurile unui ITP asa cum le vede managerul in formular (pentru "ce s-a schimbat")
    public static Map<String, String> itpFields(ItpRecord r) {
        Vehicle v = r.getVehicle();
        Client c = v.getClient();
        Map<String, String> f = new LinkedHashMap<>();
        f.put("Nume", c.getName());
        f.put("Telefon", c.getPhone());
        f.put("Număr", v.getLicensePlate() == null ? null : v.getLicensePlate().toUpperCase());
        f.put("Marcă", v.getBrand());
        f.put("Model", v.getModel());
        f.put("An", text(v.getYear()));
        f.put("VIN", v.getVin());
        f.put("Data ITP", r.getTestDate() == null ? null : r.getTestDate().format(RO_DATE));
        f.put("Valabilitate (luni)", text(r.getValidityMonths()));
        f.put("Rezultat", statusLabel(r.getStatus()));
        f.put("Kilometraj", text(r.getMileage()));
        f.put("Preț", r.getPrice() == null ? null : String.format(java.util.Locale.ROOT, "%.2f", r.getPrice()).replace('.', ','));
        f.put("Observații", r.getObservations());
        f.put("Inspector", r.getInspector());
        return f;
    }

    public static Map<String, String> vehicleFields(Vehicle v) {
        Map<String, String> f = new LinkedHashMap<>();
        f.put("Număr", v.getLicensePlate() == null ? null : v.getLicensePlate().toUpperCase());
        f.put("Marcă", v.getBrand());
        f.put("Model", v.getModel());
        f.put("An", text(v.getYear()));
        f.put("VIN", v.getVin());
        f.putAll(deadlineFields(v));
        return f;
    }

    // "RCA: 12.03.2027"; fiecare tip apare mereu, gol cand nu e completat (ca diff-ul sa vada stergerile)
    public static Map<String, String> deadlineFields(Vehicle v) {
        Map<String, String> f = new LinkedHashMap<>();
        Map<DeadlineKind, LocalDate> dates = DeadlineService.asMap(v);
        for (DeadlineKind kind : DeadlineKind.values()) {
            LocalDate d = dates.get(kind);
            f.put(kind.label(), d == null ? null : d.format(DateTimeFormatter.ofPattern("dd.MM.yyyy")));
        }
        return f;
    }

    public static Map<String, String> clientFields(Client c) {
        Map<String, String> f = new LinkedHashMap<>();
        f.put("Nume", c.getName());
        f.put("Telefon", c.getPhone());
        return f;
    }

    // "Pret: 150,00 → 200,00", cate un camp schimbat pe linie
    public static String diff(Map<String, String> before, Map<String, String> after) {
        List<String> lines = new ArrayList<>();
        for (Map.Entry<String, String> e : after.entrySet()) {
            String old = blankToNull(before.get(e.getKey()));
            String now = blankToNull(e.getValue());
            if (!Objects.equals(old, now)) {
                lines.add(e.getKey() + ": " + (old == null ? "—" : old) + " → " + (now == null ? "—" : now));
            }
        }
        return String.join("\n", lines);
    }

    private static String statusLabel(ItpStatus s) {
        if (s == null || s == ItpStatus.PASSED) return "Admis";
        return s == ItpStatus.FAILED ? "Respins" : "Reverificare";
    }

    private static String text(Object o) {
        return o == null ? null : o.toString();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
