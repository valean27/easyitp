package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Appointment;
import org.example.easyitp.entity.AuditEvent;
import org.example.easyitp.entity.AuditEvent.Action;
import org.example.easyitp.entity.Client;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.entity.ItpStatus;
import org.example.easyitp.entity.Vehicle;
import org.example.easyitp.repository.AppointmentRepository;
import org.example.easyitp.repository.AuditEventRepository;
import org.example.easyitp.repository.ItpRecordRepository;
import org.example.easyitp.repository.VehicleRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

// Pagina "Istoric" si anularea stergerilor
@Service
@RequiredArgsConstructor
public class HistoryService {

    // Cat timp o stergere mai poate fi anulata; istoricul se pastreaza un an
    static final int UNDO_DAYS = 30;
    static final int KEEP_DAYS = 365;
    private static final int MAX_PAGE_SIZE = 100;

    private final AuditEventRepository auditEventRepository;
    private final AuditService auditService;
    private final ClientService clientService;
    private final VehicleRepository vehicleRepository;
    private final ItpRecordRepository itpRecordRepository;
    private final AppointmentRepository appointmentRepository;

    public record HistoryEventDTO(Long id, LocalDateTime createdAt, String actor, Action action,
                                  AuditEvent.EntityType entityType, String summary, String changes, boolean canUndo,
                                  LocalDateTime restoredAt) {
    }

    public record HistoryPageDTO(List<HistoryEventDTO> items, long total, int page, int size) {
    }

    // filter: "deletes", "changes", "adds" sau orice altceva = toate
    @Transactional(readOnly = true)
    public HistoryPageDTO list(AppUser user, String filter, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);
        PageRequest pageable = PageRequest.of(safePage, safeSize);
        Set<Action> actions = switch (filter == null ? "" : filter) {
            case "deletes" -> EnumSet.of(Action.DELETE, Action.RESTORE);
            case "changes" -> EnumSet.of(Action.UPDATE, Action.MOVE, Action.MERGE);
            case "adds" -> EnumSet.of(Action.CREATE, Action.IMPORT);
            default -> null;
        };
        Page<AuditEvent> result = actions == null
                ? auditEventRepository.findByUserIdOrderByCreatedAtDescIdDesc(user.getId(), pageable)
                : auditEventRepository.findByUserIdAndActionInOrderByCreatedAtDescIdDesc(user.getId(), actions, pageable);
        return new HistoryPageDTO(result.stream().map(HistoryService::toDto).toList(), result.getTotalElements(),
                safePage, safeSize);
    }

    private static HistoryEventDTO toDto(AuditEvent e) {
        return new HistoryEventDTO(e.getId(), e.getCreatedAt(), e.getActor(), e.getAction(), e.getEntityType(),
                e.getSummary(), e.getChanges(), canUndo(e), e.getRestoredAt());
    }

    static boolean canUndo(AuditEvent e) {
        return e.getAction() == Action.DELETE && e.getSnapshot() != null && e.getRestoredAt() == null
                && e.getCreatedAt().isAfter(LocalDateTime.now().minusDays(UNDO_DAYS));
    }

    // Pune la loc datele sterse: clientul (sau cel cu acelasi nume si telefon), masinile si ITP-urile.
    // O masina cu acelasi numar adaugata intre timp e folosita; un ITP care exista deja nu se dubleaza.
    @Transactional
    public String undo(AppUser user, Long eventId) {
        AuditEvent event = auditEventRepository.findByIdAndUserId(eventId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Intrare inexistentă în istoric"));
        if (event.getRestoredAt() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ștergerea a fost deja anulată.");
        }
        if (!canUndo(event)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Această ștergere nu mai poate fi anulată.");
        }
        AuditService.ClientSnap snap = auditService.readSnapshot(event);
        Client owner = null;
        int restored = 0;
        for (AuditService.VehicleSnap vs : snap.vehicles()) {
            Vehicle vehicle = vehicleRepository.findByNormalizedPlate(PlateUtils.normalize(vs.licensePlate()), user.getId())
                    .stream().findFirst().orElse(null);
            if (vehicle == null) {
                if (owner == null) owner = clientService.resolveOwner(user, null, snap.name(), snap.phone());
                vehicle = vehicleRepository.save(Vehicle.builder().client(owner).licensePlate(vs.licensePlate())
                        .brand(vs.brand()).model(vs.model()).year(vs.year()).vin(vs.vin()).build());
            }
            for (AuditService.ItpSnap is : vs.itps()) {
                if (itpRecordRepository.findFirstByVehicleIdAndTestDate(vehicle.getId(), is.testDate()).isPresent()) continue;
                ItpRecord record = itpRecordRepository.save(ItpRecord.builder()
                        .vehicle(vehicle).testDate(is.testDate()).validityMonths(is.validityMonths())
                        .nextItpDate(is.nextItpDate()).status(is.status() != null ? is.status() : ItpStatus.PASSED)
                        .mileage(is.mileage()).price(is.price()).observations(is.observations())
                        .inspector(is.inspector()).reminderStatus(is.reminderStatus()).reminderAt(is.reminderAt())
                        .build());
                relinkAppointments(user, is.appointmentIds(), record.getId());
                restored++;
            }
        }
        // Un client sters fara masini (date vechi) se reface doar ca persoana
        if (snap.vehicles().isEmpty()) owner = clientService.resolveOwner(user, null, snap.name(), snap.phone());
        clientService.restoreConsent(owner, snap);

        event.setRestoredAt(LocalDateTime.now());
        auditEventRepository.save(event);
        auditService.record(user, Action.RESTORE, event.getEntityType(), event.getEntityId(), event.getSummary(),
                "Anulată ștergerea din " + event.getCreatedAt().toLocalDate().format(java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy")));
        return restored == 1 ? "A fost restaurat 1 ITP." : "Au fost restaurate " + restored + " ITP-uri.";
    }

    private void relinkAppointments(AppUser user, List<Long> appointmentIds, Long recordId) {
        if (appointmentIds == null || appointmentIds.isEmpty()) return;
        for (Appointment a : appointmentRepository.findAllById(appointmentIds)) {
            if (a.getUser() != null && Objects.equals(a.getUser().getId(), user.getId()) && a.getItpRecordId() == null) {
                a.setItpRecordId(recordId);
            }
        }
    }

    // Istoricul mai vechi de un an se sterge (apelat de rularea zilnica)
    @Transactional
    public int purgeOld() {
        return auditEventRepository.deleteOlderThan(LocalDateTime.now().minusDays(KEEP_DAYS));
    }
}
