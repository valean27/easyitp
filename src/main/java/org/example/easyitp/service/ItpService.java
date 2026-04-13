package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.example.easyitp.dto.DashboardDTO;
import org.example.easyitp.dto.ImportResultDTO;
import org.example.easyitp.dto.ItpFormDTO;
import org.example.easyitp.entity.Client;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.entity.ItpStatus;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Vehicle;
import org.example.easyitp.repository.ClientRepository;
import org.example.easyitp.repository.ItpRecordRepository;
import org.example.easyitp.repository.VehicleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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

    private final ClientRepository clientRepository;
    private final VehicleRepository vehicleRepository;
    private final ItpRecordRepository itpRecordRepository;
    private final CarService carService;

    public List<DashboardDTO> getDashboard(Long userId) {
        return itpRecordRepository.findAllByUserId(userId)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public ItpRecord createItpEntry(ItpFormDTO form, AppUser user) {
        Client client = Client.builder()
                .name(form.getName())
                .phone(form.getPhone())
                .user(user)
                .build();
        client = clientRepository.save(client);

        Vehicle vehicle = Vehicle.builder()
                .brand(form.getBrand())
                .model(nullIfBlank(form.getModel()))
                .year(form.getYear())
                .vin(nullIfBlank(form.getVin()))
                .licensePlate(form.getLicensePlate())
                .client(client)
                .build();
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

        return itpRecordRepository.save(record);
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
            var byPlate = vehicleRepository.findByLicensePlateAndClientUserId(licensePlate, user.getId());
            if (byPlate.isPresent()) return byPlate.get();
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
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private DashboardDTO toDto(ItpRecord record) {
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
                record.getObservations()
        );
    }
}
