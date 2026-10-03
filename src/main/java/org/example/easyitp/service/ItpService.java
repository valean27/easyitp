package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.DashboardDTO;
import org.example.easyitp.dto.ItpFormDTO;
import org.example.easyitp.dto.ReminderDTO;
import org.example.easyitp.entity.Client;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.entity.ItpStatus;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.ReminderStatus;
import org.example.easyitp.entity.Vehicle;
import org.example.easyitp.repository.ClientRepository;
import org.example.easyitp.repository.ItpRecordRepository;
import org.example.easyitp.repository.VehicleRepository;
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

    public List<DashboardDTO> getDashboard(Long userId) {
        List<ItpRecord> records = itpRecordRepository.findAllByUserId(userId);
        Set<Long> latest = latestRecordIds(records);
        return records.stream()
                .map(r -> toDto(r, latest.contains(r.getId())))
                .collect(Collectors.toList());
    }

    // Clientii de sunat: ultimul ITP al fiecarui vehicul, care expira curand sau a expirat recent
    public List<ReminderDTO> getReminders(Long userId) {
        List<ItpRecord> records = itpRecordRepository.findAllByUserId(userId);
        Set<Long> latest = latestRecordIds(records);
        LocalDate today = LocalDate.now();
        return records.stream()
                .filter(r -> latest.contains(r.getId()))
                .map(r -> {
                    long days = ChronoUnit.DAYS.between(today, r.getNextItpDate());
                    if (days > REMINDER_DAYS_AHEAD || days < -REMINDER_DAYS_EXPIRED) return null;
                    Vehicle v = r.getVehicle();
                    Client c = v.getClient();
                    return new ReminderDTO(r.getId(), c.getName(), c.getPhone(), v.getBrand(), v.getModel(),
                            v.getLicensePlate(), r.getNextItpDate(), days, r.getReminderStatus(), r.getReminderAt());
                })
                .filter(Objects::nonNull)
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
    public Map<Long, StationStats> stationStats(int expiringSoonDays) {
        List<ItpRecord> records = itpRecordRepository.findAllWithVehicle();
        Set<Long> latest = latestRecordIds(records);
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate soon = today.plusDays(expiringSoonDays);

        Map<Long, StationStats> result = new HashMap<>();
        for (ItpRecord r : records) {
            Long ownerId = ownerId(r);
            if (ownerId == null) continue;
            StationStats s = result.computeIfAbsent(ownerId, k -> new StationStats());
            s.total++;
            if (!r.getTestDate().isBefore(monthStart)) {
                s.thisMonth++;
                s.revenueThisMonth += r.getPrice() != null ? r.getPrice() : 0.0;
            }
            if (latest.contains(r.getId())) {
                if (r.getNextItpDate().isBefore(today)) s.expired++;
                else if (!r.getNextItpDate().isAfter(soon)) s.expiringSoon++;
            }
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
        // Acelasi numar de inmatriculare = acelasi vehicul, ca sa se pastreze istoricul ITP
        Vehicle vehicle = vehicleRepository
                .findByNormalizedPlate(PlateUtils.normalize(form.getLicensePlate()), user.getId())
                .stream().findFirst().orElse(null);

        if (vehicle == null) {
            Client client = clientRepository.save(Client.builder()
                    .name(form.getName())
                    .phone(form.getPhone())
                    .user(user)
                    .build());
            vehicle = Vehicle.builder().client(client).build();
        } else {
            Client client = vehicle.getClient();
            client.setName(form.getName());
            if (!isBlank(form.getPhone())) client.setPhone(form.getPhone());
        }
        vehicle.setBrand(form.getBrand());
        vehicle.setModel(nullIfBlank(form.getModel()));
        vehicle.setYear(form.getYear());
        if (!isBlank(form.getVin()) || vehicle.getId() == null) vehicle.setVin(nullIfBlank(form.getVin()));
        vehicle.setLicensePlate(form.getLicensePlate());
        vehicle = vehicleRepository.save(vehicle);

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
        if (form.getAppointmentId() != null) {
            appointmentService.completeWithItp(form.getAppointmentId(), user.getId(), record.getId());
        }
        return record;
    }

    // Ultimul ITP al unui vehicul dupa numar, pentru precompletarea formularului la clientii care revin
    public Optional<DashboardDTO> lookupByPlate(String plate, Long userId) {
        String normalized = PlateUtils.normalize(plate);
        if (normalized.isEmpty()) return Optional.empty();
        return itpRecordRepository.findAllByUserId(userId).stream()
                .filter(r -> normalized.equals(PlateUtils.normalize(r.getVehicle().getLicensePlate())))
                .reduce((a, b) -> isNewer(b, a) ? b : a)
                .map(r -> toDto(r, true));
    }

    // Clientul si vehiculul pot fi comune mai multor inregistrari (import), deci modificarile lor se propaga
    @Transactional
    public void updateItpEntry(Long id, ItpFormDTO form, Long userId) {
        ItpRecord record = itpRecordRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inregistrare inexistenta"));
        if (form.getTestDate() == null || form.getValidityMonths() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Data ITP si valabilitatea sunt obligatorii");
        }

        Vehicle vehicle = record.getVehicle();
        Client client = vehicle.getClient();
        client.setName(form.getName());
        client.setPhone(nullIfBlank(form.getPhone()));

        vehicle.setBrand(form.getBrand());
        vehicle.setModel(nullIfBlank(form.getModel()));
        vehicle.setYear(form.getYear());
        vehicle.setVin(nullIfBlank(form.getVin()));
        vehicle.setLicensePlate(form.getLicensePlate());

        record.setTestDate(form.getTestDate());
        record.setValidityMonths(form.getValidityMonths());
        record.setNextItpDate(form.getTestDate().plusMonths(form.getValidityMonths()));
        record.setStatus(form.getStatus() != null ? form.getStatus() : ItpStatus.PASSED);
        record.setMileage(form.getMileage());
        record.setPrice(form.getPrice() != null ? form.getPrice() : 0.0);
        record.setObservations(form.getObservations());
        record.setInspector(inspector(form.getInspector()));
    }

    @Transactional
    public void deleteItpRecord(Long id, Long userId) {
        ItpRecord record = itpRecordRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inregistrare inexistenta"));
        itpRecordRepository.delete(record);
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
