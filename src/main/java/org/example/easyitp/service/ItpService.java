package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.DashboardDTO;
import org.example.easyitp.dto.DashboardPageDTO;
import org.example.easyitp.dto.DashboardSummaryDTO;
import org.example.easyitp.dto.ItpFormDTO;
import org.example.easyitp.dto.ReminderDTO;
import org.example.easyitp.entity.Client;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.entity.ItpStatus;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.AuditEvent.Action;
import org.example.easyitp.entity.AuditEvent.EntityType;
import org.example.easyitp.entity.ReminderStatus;
import org.example.easyitp.entity.Vehicle;
import org.example.easyitp.repository.ClientRepository;
import org.example.easyitp.repository.ItpRecordRepository;
import org.example.easyitp.repository.VehicleRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ItpService {

    // Fereastra listei "De contactat"
    private static final int REMINDER_DAYS_AHEAD = 30;
    private static final int REMINDER_DAYS_EXPIRED = 60;

    private final ClientRepository clientRepository;
    private final VehicleRepository vehicleRepository;
    private final ItpRecordRepository itpRecordRepository;
    private final AppointmentService appointmentService;
    private final ClientService clientService;
    private final AuditService auditService;

    static final int MAX_PAGE_SIZE = 100;
    private static final int EXPIRING_SOON_DAYS = 30;

    // Toata statia (exportul CSV si endpoint-ul vechi /dashboard)
    public List<DashboardDTO> getDashboard(Long userId) {
        List<ItpRecord> records = itpRecordRepository.findAllByUserId(userId);
        Set<Long> latest = latestRecordIds(records);
        return records.stream()
                .map(r -> toDto(r, latest.contains(r.getId())))
                .collect(Collectors.toList());
    }

    // O pagina din tabel, filtrata pe server; "CJ13FAN" gaseste si "CJ 13-FAN"
    @Transactional(readOnly = true)
    public DashboardPageDTO page(Long userId, String query, boolean onlyLatest, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        String plate = PlateUtils.normalize(q);
        Page<ItpRecord> result = itpRecordRepository.searchStation(userId, onlyLatest,
                q.isEmpty() ? "" : "%" + escapeLike(q) + "%",
                plate.isEmpty() ? "" : "%" + escapeLike(plate) + "%",
                PageRequest.of(safePage, safeSize));
        Set<Long> latest;
        if (onlyLatest) {
            latest = result.stream().map(ItpRecord::getId).collect(Collectors.toSet());
        } else if (result.isEmpty()) {
            latest = Set.of();
        } else {
            latest = new HashSet<>(itpRecordRepository.latestIdsAmong(userId,
                    result.stream().map(ItpRecord::getId).toList()));
        }
        List<DashboardDTO> items = result.stream().map(r -> toDto(r, latest.contains(r.getId()))).toList();
        return new DashboardPageDTO(items, result.getTotalElements(), safePage, safeSize);
    }

    // Caracterele speciale din LIKE se cauta ca text
    private static String escapeLike(String s) {
        return s.replace("!", "!!").replace("%", "!%").replace("_", "!_");
    }

    @Transactional(readOnly = true)
    public DashboardSummaryDTO summary(Long userId) {
        LocalDate today = LocalDate.now();
        Object[] row = itpRecordRepository.latestSummary(userId, today, today.plusDays(EXPIRING_SOON_DAYS)).get(0);
        long vehicles = number(row[0]), expired = number(row[1]), soon = number(row[2]);
        return new DashboardSummaryDTO(vehicles, vehicles - expired - soon, soon, expired);
    }

    // Toate ITP-urile unui vehicul (dupa numar), cel mai nou primul
    @Transactional(readOnly = true)
    public List<DashboardDTO> history(String plate, Long userId) {
        String normalized = PlateUtils.normalize(plate);
        if (normalized.isEmpty()) return List.of();
        List<ItpRecord> records = itpRecordRepository.findByPlate(userId, normalized);
        return records.stream().map(r -> toDto(r, r == records.get(0))).toList();
    }

    private static long number(Object value) {
        return value == null ? 0 : ((Number) value).longValue();
    }

    // Clientii de sunat: ultimul ITP al fiecarui vehicul, care expira curand sau a expirat recent
    @Transactional(readOnly = true)
    public List<ReminderDTO> getReminders(Long userId) {
        LocalDate today = LocalDate.now();
        return itpRecordRepository.findLatestExpiringBetween(userId,
                        today.minusDays(REMINDER_DAYS_EXPIRED), today.plusDays(REMINDER_DAYS_AHEAD)).stream()
                .map(r -> {
                    Vehicle v = r.getVehicle();
                    Client c = v.getClient();
                    return new ReminderDTO(r.getId(), c.getName(), c.getPhone(), v.getBrand(), v.getModel(),
                            v.getLicensePlate(), r.getNextItpDate(), ChronoUnit.DAYS.between(today, r.getNextItpDate()),
                            r.getReminderStatus(), r.getReminderAt());
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public void updateReminder(Long id, Long userId, ReminderStatus status) {
        ItpRecord record = itpRecordRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inregistrare inexistenta"));
        record.setReminderStatus(status);
        record.setReminderAt(status != null ? LocalDateTime.now() : null);
    }

    // Statistici per statie (cheie = id manager) pentru pagina adminului
    // Calculat in baza de date (GROUP BY), fara sa incarcam inregistrarile tuturor statiilor
    @Transactional(readOnly = true)
    public Map<Long, StationStats> stationStats(int expiringSoonDays) {
        LocalDate today = LocalDate.now();
        Map<Long, StationStats> result = new HashMap<>();
        for (Object[] row : itpRecordRepository.stationTotals(today.withDayOfMonth(1))) {
            StationStats s = result.computeIfAbsent((Long) row[0], k -> new StationStats());
            s.total = number(row[1]);
            s.thisMonth = number(row[2]);
            s.revenueThisMonth = row[3] == null ? 0 : ((Number) row[3]).doubleValue();
        }
        for (Object[] row : itpRecordRepository.stationExpiry(today, today.plusDays(expiringSoonDays))) {
            StationStats s = result.computeIfAbsent((Long) row[0], k -> new StationStats());
            s.expired = number(row[1]);
            s.expiringSoon = number(row[2]);
        }
        return result;
    }

    public static class StationStats {
        public long total;
        public long expired;
        public long expiringSoon;
        public long thisMonth;
        public double revenueThisMonth;
    }

    // Un vehicul (dupa numar normalizat) poate avea mai multe ITP-uri; doar cel mai recent conteaza pentru expirare
    private Set<Long> latestRecordIds(List<ItpRecord> records) {
        Map<String, ItpRecord> latestByVehicle = new HashMap<>();
        for (ItpRecord r : records) {
            Vehicle v = r.getVehicle();
            String plate = PlateUtils.normalize(v.getLicensePlate());
            String key = ownerId(r) + ":" + (plate.isEmpty() ? "v" + v.getId() : plate);
            latestByVehicle.merge(key, r, (a, b) -> isNewer(b, a) ? b : a);
        }
        Set<Long> ids = new HashSet<>();
        latestByVehicle.values().forEach(r -> ids.add(r.getId()));
        return ids;
    }

    // Managerul caruia ii apartine inregistrarea; null pentru clientii vechi creati fara utilizator
    private static Long ownerId(ItpRecord r) {
        AppUser user = r.getVehicle().getClient().getUser();
        return user != null ? user.getId() : null;
    }

    private static boolean isNewer(ItpRecord a, ItpRecord b) {
        int cmp = a.getTestDate().compareTo(b.getTestDate());
        return cmp != 0 ? cmp > 0 : a.getId() > b.getId();
    }

    @Transactional
    public ItpRecord createItpEntry(ItpFormDTO form, AppUser user) {
        validate(form);
        // Acelasi numar de inmatriculare = acelasi vehicul, ca sa se pastreze istoricul ITP
        Vehicle vehicle = vehicleRepository
                .findByNormalizedPlate(PlateUtils.normalize(form.getLicensePlate()), user.getId())
                .stream().findFirst().orElse(null);
        if (vehicle == null) vehicle = new Vehicle();

        applyVehicle(vehicle, form);
        vehicle = assignOwner(user, vehicle, form);

        LocalDate nextItp = form.getTestDate().plusMonths(form.getValidityMonths());

        ItpRecord record = ItpRecord.builder()
                .vehicle(vehicle)
                .testDate(form.getTestDate())
                .validityMonths(form.getValidityMonths())
                .nextItpDate(nextItp)
                .status(form.getStatus() != null ? form.getStatus() : ItpStatus.PASSED)
                .mileage(form.getMileage())
                .price(form.getPrice() != null ? form.getPrice() : 0.0)
                .observations(form.getObservations())
                .inspector(inspector(form.getInspector()))
                .build();

        record = itpRecordRepository.save(record);
        auditService.record(user, Action.CREATE, EntityType.ITP, record.getId(), AuditService.itpSummary(record), null);
        if (form.getAppointmentId() != null) {
            appointmentService.completeWithItp(form.getAppointmentId(), user.getId(), record.getId());
        }
        return record;
    }

    // Ultimul ITP al unui vehicul dupa numar, pentru precompletarea formularului la clientii care revin
    @Transactional(readOnly = true)
    public Optional<DashboardDTO> lookupByPlate(String plate, Long userId) {
        return history(plate, userId).stream().findFirst();
    }

    // Datele masinii (marca, VIN...) si ale clientului sunt comune tuturor ITP-urilor masinii. Numarul schimbat insa
    // muta doar acest ITP: pe masina care are deja numarul nou, sau pe o masina noua daca vechea mai are alte ITP-uri.
    @Transactional
    public void updateItpEntry(Long id, ItpFormDTO form, AppUser user) {
        validate(form);
        ItpRecord record = itpRecordRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inregistrare inexistenta"));

        Map<String, String> before = AuditService.itpFields(record);
        Vehicle previous = record.getVehicle();
        Vehicle vehicle = previous;
        String plateKey = PlateUtils.normalize(form.getLicensePlate());
        if (!plateKey.equals(previous.getNormalizedPlate())) {
            Vehicle other = vehicleRepository.findByNormalizedPlate(plateKey, user.getId()).stream()
                    .filter(v -> !v.getId().equals(previous.getId()))
                    .findFirst().orElse(null);
            if (other != null) {
                vehicle = other;
            } else if (itpRecordRepository.countByVehicleId(previous.getId()) > 1) {
                vehicle = Vehicle.builder().client(previous.getClient()).build();
            }
        }
        applyVehicle(vehicle, form);
        vehicle = assignOwner(user, vehicle, form);
        record.setVehicle(vehicle);

        record.setTestDate(form.getTestDate());
        record.setValidityMonths(form.getValidityMonths());
        record.setNextItpDate(form.getTestDate().plusMonths(form.getValidityMonths()));
        record.setStatus(form.getStatus() != null ? form.getStatus() : ItpStatus.PASSED);
        record.setMileage(form.getMileage());
        record.setPrice(form.getPrice() != null ? form.getPrice() : 0.0);
        record.setObservations(form.getObservations());
        record.setInspector(inspector(form.getInspector()));
        itpRecordRepository.saveAndFlush(record);
        String changes = AuditService.diff(before, AuditService.itpFields(record));
        if (!changes.isEmpty()) {
            auditService.record(user, Action.UPDATE, EntityType.ITP, record.getId(), AuditService.itpSummary(record), changes);
        }
        if (vehicle != previous) clientService.deleteVehicleIfEmpty(previous);
    }

    // Masina si clientul ramasi fara niciun ITP dispar odata cu ultimul lor ITP
    // Intoarce intrarea din istoric (pentru "Anuleaza")
    @Transactional
    public Long deleteItpRecord(Long id, AppUser user) {
        ItpRecord record = itpRecordRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inregistrare inexistenta"));
        Vehicle vehicle = record.getVehicle();
        Long eventId = auditService.recordDeletion(user, EntityType.ITP, record.getId(), AuditService.itpSummary(record),
                clientService.snapshot(vehicle.getClient(), List.of(vehicle), List.of(record)));
        clientService.deleteRecords(List.of(record));
        clientService.deleteVehicleIfEmpty(vehicle);
        return eventId;
    }

    private static void applyVehicle(Vehicle vehicle, ItpFormDTO form) {
        vehicle.setLicensePlate(form.getLicensePlate().trim().toUpperCase(Locale.ROOT));
        vehicle.setBrand(form.getBrand().trim());
        vehicle.setModel(nullIfBlankStatic(form.getModel()));
        vehicle.setYear(form.getYear());
        // un VIN gol in formular nu sterge VIN-ul stiut al masinii
        if (!isBlank(form.getVin()) || vehicle.getId() == null) {
            vehicle.setVin(isBlank(form.getVin()) ? null : form.getVin().trim().toUpperCase(Locale.ROOT));
        }
    }

    // Masina trece la proprietarul din formular (vezi ClientService.resolveOwner); clientul vechi ramas fara masini dispare
    private Vehicle assignOwner(AppUser user, Vehicle vehicle, ItpFormDTO form) {
        Client previousOwner = vehicle.getClient();
        Client owner = clientService.resolveOwner(user, vehicle, form.getName(), form.getPhone());
        vehicle.setClient(owner);
        Vehicle saved = vehicleRepository.saveAndFlush(vehicle);
        if (previousOwner != null && !previousOwner.getId().equals(owner.getId())) {
            clientService.deleteClientIfEmpty(previousOwner);
        }
        return saved;
    }

    // Formularul ITP: campurile obligatorii si valori plauzibile, cu mesaje pentru interfata (400, nu 500)
    static void validate(ItpFormDTO form) {
        if (isBlank(form.getName())) throw badRequest("Introduceți numele clientului");
        if (form.getName().trim().length() > 120) throw badRequest("Numele este prea lung");
        if (isBlank(form.getLicensePlate()) || PlateUtils.normalize(form.getLicensePlate()).length() < 2) {
            throw badRequest("Introduceți numărul de înmatriculare");
        }
        if (PlateUtils.normalize(form.getLicensePlate()).length() > 15) throw badRequest("Numărul de înmatriculare este prea lung");
        if (isBlank(form.getBrand())) throw badRequest("Introduceți marca");
        if (form.getTestDate() == null) throw badRequest("Introduceți data ITP");
        if (form.getTestDate().isAfter(LocalDate.now().plusDays(1))) throw badRequest("Data ITP nu poate fi în viitor");
        if (form.getTestDate().isBefore(LocalDate.of(1990, 1, 1))) throw badRequest("Data ITP este prea veche");
        if (form.getValidityMonths() == null || form.getValidityMonths() < 1 || form.getValidityMonths() > 36) {
            throw badRequest("Valabilitatea trebuie să fie între 1 și 36 de luni");
        }
        if (form.getPrice() != null && (form.getPrice() < 0 || form.getPrice() > 100_000)) throw badRequest("Preț invalid");
        if (form.getMileage() != null && (form.getMileage() < 0 || form.getMileage() > 5_000_000)) throw badRequest("Kilometraj invalid");
        if (form.getYear() != null && (form.getYear() < 1900 || form.getYear() > LocalDate.now().getYear() + 1)) {
            throw badRequest("An de fabricație invalid");
        }
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static String nullIfBlankStatic(String s) {
        return isBlank(s) ? null : s.trim();
    }

    public byte[] generateCsvExport(Long userId) throws IOException {
        List<DashboardDTO> records = getDashboard(userId);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd.MM.yyyy");
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        baos.write(new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF});
        try (PrintWriter pw = new PrintWriter(new OutputStreamWriter(baos, StandardCharsets.UTF_8))) {
            pw.println("Nume sofer,Contact,Marca vehicul,VIN,Numar inmatriculare,Data efectuare ITP,Perioada valabilitate ITP (luni),Data urmatorul ITP,Zile ramase ITP");
            for (DashboardDTO r : records) {
                pw.println(String.join(",",
                        csvEscape(r.getNumeSofer()),
                        csvEscape(r.getContact() != null ? r.getContact() : ""),
                        csvEscape(r.getMarca()),
                        csvEscape(r.getVin() != null ? r.getVin() : ""),
                        csvEscape(r.getNumarInmatriculare() != null ? r.getNumarInmatriculare() : ""),
                        r.getDataItp().format(fmt),
                        String.valueOf(r.getValabilitateLuni()),
                        r.getDataUrmatorItp().format(fmt),
                        String.valueOf(r.getZileRamase())
                ));
            }
        }
        return baos.toByteArray();
    }

    private String csvEscape(String val) {
        return CsvCells.cell(val, ',');
    }

    private String nullIfBlank(String s) {
        return isBlank(s) ? null : s.trim();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private DashboardDTO toDto(ItpRecord record, boolean latest) {
        Vehicle vehicle = record.getVehicle();
        Client client = vehicle.getClient();
        long daysRemaining = ChronoUnit.DAYS.between(LocalDate.now(), record.getNextItpDate());

        return new DashboardDTO(
                record.getId(),
                client.getName(),
                client.getPhone(),
                vehicle.getBrand(),
                vehicle.getModel(),
                vehicle.getYear(),
                vehicle.getVin(),
                vehicle.getLicensePlate(),
                record.getTestDate(),
                record.getValidityMonths(),
                record.getNextItpDate(),
                daysRemaining,
                record.getStatus() != null ? record.getStatus() : ItpStatus.PASSED,
                record.getMileage(),
                record.getPrice() != null ? record.getPrice() : 0.0,
                record.getObservations(),
                latest,
                record.getInspector()
        );
    }

    private static String inspector(String name) {
        if (name == null || name.isBlank()) return null;
        String trimmed = name.trim();
        return trimmed.length() > 80 ? trimmed.substring(0, 80) : trimmed;
    }
}
