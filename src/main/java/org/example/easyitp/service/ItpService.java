package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.example.easyitp.dto.DashboardDTO;
import org.example.easyitp.dto.ImportResultDTO;
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
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
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

    private static final List<DateTimeFormatter> DATE_FORMATTERS = List.of(
            DateTimeFormatter.ofPattern("dd.MM.yyyy"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy"),
            DateTimeFormatter.ofPattern("d.M.yyyy"),
            DateTimeFormatter.ofPattern("d/M/yyyy")
    );

    private static final DateTimeFormatter ROMANIAN_DATE_FMT = DateTimeFormatter.ofPattern("d-MM-yyyy");

    private static final Map<String, String> RO_MONTHS = Map.ofEntries(
            Map.entry("ian", "01"), Map.entry("feb", "02"), Map.entry("mar", "03"),
            Map.entry("apr", "04"), Map.entry("mai", "05"), Map.entry("iun", "06"),
            Map.entry("iul", "07"), Map.entry("aug", "08"), Map.entry("sep", "09"),
            Map.entry("oct", "10"), Map.entry("nov", "11"), Map.entry("dec", "12")
    );

    // Fereastra listei "De contactat"
    private static final int REMINDER_DAYS_AHEAD = 30;
    private static final int REMINDER_DAYS_EXPIRED = 60;

    private final ClientRepository clientRepository;
    private final VehicleRepository vehicleRepository;
    private final ItpRecordRepository itpRecordRepository;
    private final CarService carService;
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
            StationStats s = result.computeIfAbsent(r.getVehicle().getClient().getUser().getId(), k -> new StationStats());
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
            String key = v.getClient().getUser().getId() + ":" + (plate.isEmpty() ? "v" + v.getId() : plate);
            latestByVehicle.merge(key, r, (a, b) -> isNewer(b, a) ? b : a);
        }
        Set<Long> ids = new HashSet<>();
        latestByVehicle.values().forEach(r -> ids.add(r.getId()));
        return ids;
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
    }

    @Transactional
    public void deleteItpRecord(Long id, Long userId) {
        ItpRecord record = itpRecordRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new RuntimeException("Record not found or access denied"));
        itpRecordRepository.delete(record);
    }

    @Transactional
    public ImportResultDTO importCsv(MultipartFile file, AppUser user) throws IOException {
        int imported = 0;
        int skipped = 0;
        List<String> errors = new ArrayList<>();

        byte[] bytes = file.getBytes();
        int start = 0;
        if (bytes.length >= 3
                && (bytes[0] & 0xFF) == 0xEF
                && (bytes[1] & 0xFF) == 0xBB
                && (bytes[2] & 0xFF) == 0xBF) {
            start = 3;
        }

        try (Reader reader = new InputStreamReader(
                new ByteArrayInputStream(bytes, start, bytes.length - start),
                StandardCharsets.UTF_8);
             CSVParser parser = CSVFormat.DEFAULT.builder()
                     .setHeader()
                     .setSkipHeaderRecord(true)
                     .setIgnoreEmptyLines(true)
                     .setTrim(true)
                     .build()
                     .parse(reader)) {

            for (CSVRecord record : parser) {
                long lineNum = record.getRecordNumber() + 1;
                try {
                    String dataItpStr = col(record, "Data efectuare ITP");
                    if (dataItpStr.isBlank()) {
                        skipped++;
                        continue;
                    }

                    String numeSofer = col(record, "Nume sofer");
                    if (numeSofer.isBlank()) {
                        skipped++;
                        continue;
                    }

                    LocalDate testDate = parseDate(dataItpStr);
                    if (testDate == null) {
                        errors.add("Linia " + lineNum + ": dată invalidă \"" + dataItpStr + "\"");
                        skipped++;
                        continue;
                    }

                    String perioadaStr = col(record, "Perioada valabilitate ITP (luni)");
                    Integer validityMonths = parseValidityMonths(perioadaStr);
                    if (validityMonths == null) {
                        errors.add("Linia " + lineNum + ": valabilitate invalidă \"" + perioadaStr + "\"");
                        skipped++;
                        continue;
                    }

                    String contact = col(record, "Contact");
                    String marca = col(record, "Marca vehicul");
                    String vin = col(record, "VIN");
                    String numarInmatriculare = col(record, "Numar inmatriculare");

                    if (!marca.isBlank()) {
                        carService.findOrCreateMake(marca);
                    }

                    Client client = findOrCreateClient(numeSofer, contact, user);
                    Vehicle vehicle = findOrCreateVehicle(marca, vin, numarInmatriculare, client, user);

                    itpRecordRepository.save(ItpRecord.builder()
                            .vehicle(vehicle)
                            .testDate(testDate)
                            .validityMonths(validityMonths)
                            .nextItpDate(testDate.plusMonths(validityMonths))
                            .status(ItpStatus.PASSED)
                            .price(0.0)
                            .build());

                    imported++;
                } catch (Exception e) {
                    errors.add("Linia " + lineNum + ": " + e.getMessage());
                    skipped++;
                }
            }
        }

        return new ImportResultDTO(imported, skipped, errors);
    }

    private Client findOrCreateClient(String name, String phone, AppUser user) {
        if (!phone.isBlank()) {
            return clientRepository.findByNameAndPhoneAndUserId(name, phone, user.getId())
                    .orElseGet(() -> clientRepository.save(
                            Client.builder().name(name).phone(phone).user(user).build()));
        }
        return clientRepository.findByNameAndUserId(name, user.getId())
                .orElseGet(() -> clientRepository.save(
                        Client.builder().name(name).phone(null).user(user).build()));
    }

    private Vehicle findOrCreateVehicle(String brand, String vin, String licensePlate, Client client, AppUser user) {
        if (!vin.isBlank()) {
            var byVin = vehicleRepository.findByVinAndClientUserId(vin, user.getId());
            if (byVin.isPresent()) return byVin.get();
        }
        if (!licensePlate.isBlank()) {
            var byPlate = vehicleRepository.findByNormalizedPlate(PlateUtils.normalize(licensePlate), user.getId());
            if (!byPlate.isEmpty()) return byPlate.get(0);
        }
        return vehicleRepository.save(Vehicle.builder()
                .brand(brand.isBlank() ? "Necunoscut" : brand)
                .vin(nullIfBlank(vin))
                .licensePlate(licensePlate.isBlank() ? null : licensePlate)
                .client(client)
                .build());
    }

    private LocalDate parseDate(String raw) {
        String cleaned = raw.trim();
        for (DateTimeFormatter fmt : DATE_FORMATTERS) {
            try {
                return LocalDate.parse(cleaned, fmt);
            } catch (Exception ignored) {
            }
        }
        try {
            return LocalDate.parse(normalizeRomanianDate(cleaned), ROMANIAN_DATE_FMT);
        } catch (Exception ignored) {
        }
        return null;
    }

    private String normalizeRomanianDate(String raw) {
        String s = raw.trim().replace(".", "").toLowerCase();
        for (Map.Entry<String, String> e : RO_MONTHS.entrySet()) {
            s = s.replace(e.getKey(), e.getValue());
        }
        return s;
    }

    private Integer parseValidityMonths(String raw) {
        try {
            int val = Integer.parseInt(raw.trim());
            if (val > 0) return val;
        } catch (NumberFormatException ignored) {
        }
        return null;
    }

    private String col(CSVRecord record, String header) {
        try {
            String v = record.get(header);
            return v != null ? v.trim() : "";
        } catch (Exception e) {
            return "";
        }
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
        if (val == null) return "";
        if (val.contains(",") || val.contains("\"") || val.contains("\n")) {
            return "\"" + val.replace("\"", "\"\"") + "\"";
        }
        return val;
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
                latest
        );
    }
}
