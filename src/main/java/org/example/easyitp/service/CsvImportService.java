package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.example.easyitp.dto.ImportResultDTO;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.AuditEvent;
import org.example.easyitp.entity.Client;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.entity.ItpStatus;
import org.example.easyitp.entity.Vehicle;
import org.example.easyitp.repository.ItpRecordRepository;
import org.example.easyitp.repository.VehicleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// Importul CSV de ITP-uri (acelasi format ca exportul din dashboard).
// Reimportul nu dubleaza nimic: acelasi numar de inmatriculare + aceeasi data ITP suprascrie inregistrarea existenta.
@Service
@RequiredArgsConstructor
public class CsvImportService {

    private static final List<DateTimeFormatter> DATE_FORMATTERS = List.of(
            DateTimeFormatter.ofPattern("d.M.yyyy"),
            DateTimeFormatter.ofPattern("d/M/yyyy"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("d-M-yyyy"));

    // "9-mar.-2026", "10-sept.-2026", "11 mai 2026"
    private static final Pattern TEXT_MONTH_DATE = Pattern.compile("^(\\d{1,2})[-./ ]+([a-z]+)\\.?[-./ ]+(\\d{4})$");

    // Primele 3 litere ale lunii, in romana si engleza (Excel poate exporta in oricare)
    private static final Map<String, Integer> MONTHS = Map.ofEntries(
            Map.entry("ian", 1), Map.entry("jan", 1), Map.entry("feb", 2), Map.entry("mar", 3), Map.entry("apr", 4),
            Map.entry("mai", 5), Map.entry("may", 5), Map.entry("iun", 6), Map.entry("jun", 6),
            Map.entry("iul", 7), Map.entry("jul", 7), Map.entry("aug", 8), Map.entry("sep", 9), Map.entry("oct", 10),
            Map.entry("noi", 11), Map.entry("nov", 11), Map.entry("dec", 12));

    private final ClientService clientService;
    private final AuditService auditService;
    private final VehicleRepository vehicleRepository;
    private final ItpRecordRepository itpRecordRepository;
    private final CarService carService;

    @Transactional
    public ImportResultDTO importCsv(MultipartFile file, AppUser user) throws IOException {
        int imported = 0, updated = 0, skipped = 0;
        List<String> errors = new ArrayList<>();
        VehicleNameParser vehicleNames = carService.vehicleNameParser();

        try (Reader reader = new InputStreamReader(withoutBom(file.getBytes()), StandardCharsets.UTF_8);
             CSVParser parser = CSVFormat.DEFAULT.builder()
                     .setHeader()
                     .setSkipHeaderRecord(true)
                     .setIgnoreEmptyLines(true)
                     .setTrim(true)
                     .build()
                     .parse(reader)) {

            for (CSVRecord record : parser) {
                long line = record.getRecordNumber() + 1;
                String name = col(record, "Nume sofer");
                String dateRaw = col(record, "Data efectuare ITP");
                String plate = col(record, "Numar inmatriculare");

                // Randurile goale (doar formulele din Excel) se sar fara mesaj
                if (name.isEmpty() && dateRaw.isEmpty() && plate.isEmpty()) {
                    skipped++;
                    continue;
                }
                // Validam tot inainte de salvare: o eroare la salvare ar anula tot importul
                String problem = null;
                LocalDate testDate = parseDate(dateRaw);
                Integer validity = parseValidity(col(record, "Perioada valabilitate ITP (luni)"));
                if (name.isEmpty()) problem = "lipsește numele șoferului";
                else if (plate.isEmpty()) problem = "lipsește numărul de înmatriculare";
                else if (testDate == null) problem = "dată ITP invalidă \"" + dateRaw + "\"";
                else if (validity == null) problem = "valabilitate invalidă \"" + col(record, "Perioada valabilitate ITP (luni)") + "\"";
                if (problem != null) {
                    errors.add("Linia " + line + ": " + problem);
                    skipped++;
                    continue;
                }

                String phone = normalizePhone(col(record, "Contact"));
                String vin = col(record, "VIN");
                VehicleNameParser.ParsedVehicle parsed = vehicleNames.parse(col(record, "Marca vehicul"));

                Vehicle vehicle = upsertVehicle(user, plate, name, phone, vin, parsed);
                ItpRecord existing = itpRecordRepository.findFirstByVehicleIdAndTestDate(vehicle.getId(), testDate).orElse(null);
                ItpRecord itp = existing != null ? existing : ItpRecord.builder()
                        .vehicle(vehicle)
                        .testDate(testDate)
                        .status(ItpStatus.PASSED)
                        .price(0.0)
                        .build();
                itp.setValidityMonths(validity);
                itp.setNextItpDate(testDate.plusMonths(validity));
                itpRecordRepository.save(itp);
                if (existing != null) updated++;
                else imported++;
            }
        }
        if (imported + updated > 0) {
            auditService.record(user, AuditEvent.Action.IMPORT, AuditEvent.EntityType.ITP, null,
                    "Import CSV: " + imported + " noi, " + updated + " actualizate, " + skipped + " ignorate", null);
        }
        return new ImportResultDTO(imported, updated, skipped, errors);
    }

    // Acelasi numar (fara spatii/cratime) = acelasi vehicul; datele din fisier suprascriu ce exista
    private Vehicle upsertVehicle(AppUser user, String plate, String name, String phone, String vin,
                                  VehicleNameParser.ParsedVehicle parsed) {
        Vehicle vehicle = vehicleRepository.findByNormalizedPlate(PlateUtils.normalize(plate), user.getId())
                .stream().findFirst().orElse(null);
        if (vehicle == null) vehicle = new Vehicle();
        // Proprietarul: acelasi om (nume + telefon) poate avea mai multe masini; vezi ClientService.resolveOwner
        Client previousOwner = vehicle.getClient();
        Client owner = clientService.resolveOwner(user, vehicle, name, phone);
        vehicle.setClient(owner);
        vehicle.setLicensePlate(plate.toUpperCase(Locale.ROOT));
        vehicle.setBrand(parsed.brand());
        if (parsed.model() != null) vehicle.setModel(parsed.model());
        if (parsed.year() != null) vehicle.setYear(parsed.year());
        // VIN-ul se pastreaza doar daca e complet (17 caractere); "wvw", "tmb" sunt doar prefixe
        if (vin.length() == 17) vehicle.setVin(vin.toUpperCase(Locale.ROOT));
        Vehicle saved = vehicleRepository.saveAndFlush(vehicle);
        if (previousOwner != null && !previousOwner.getId().equals(owner.getId())) clientService.deleteClientIfEmpty(previousOwner);
        return saved;
    }

    static LocalDate parseDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String cleaned = raw.trim();
        for (DateTimeFormatter fmt : DATE_FORMATTERS) {
            try {
                return LocalDate.parse(cleaned, fmt);
            } catch (Exception ignored) {
                // incercam urmatorul format
            }
        }
        String ascii = Normalizer.normalize(cleaned, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
        Matcher m = TEXT_MONTH_DATE.matcher(ascii);
        if (m.matches() && m.group(2).length() >= 3) {
            Integer month = MONTHS.get(m.group(2).substring(0, 3));
            if (month != null) {
                try {
                    return LocalDate.of(Integer.parseInt(m.group(3)), month, Integer.parseInt(m.group(1)));
                } catch (Exception ignored) {
                    // zi invalida, ex. 31-feb
                }
            }
        }
        return null;
    }

    // "12", "12 luni"
    static Integer parseValidity(String raw) {
        Matcher m = Pattern.compile("^(\\d{1,2})").matcher(raw == null ? "" : raw.trim());
        if (!m.find()) return null;
        int value = Integer.parseInt(m.group(1));
        return value > 0 ? value : null;
    }

    // Excel sterge 0-ul din fata: "739963246" -> "0739963246"
    static String normalizePhone(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String digits = raw.replaceAll("\\D", "");
        if (digits.length() == 9 && "237".indexOf(digits.charAt(0)) >= 0) return "0" + digits;
        return raw.trim();
    }

    private static ByteArrayInputStream withoutBom(byte[] bytes) {
        boolean bom = bytes.length >= 3 && (bytes[0] & 0xFF) == 0xEF && (bytes[1] & 0xFF) == 0xBB && (bytes[2] & 0xFF) == 0xBF;
        return bom ? new ByteArrayInputStream(bytes, 3, bytes.length - 3) : new ByteArrayInputStream(bytes);
    }

    private static String col(CSVRecord record, String header) {
        try {
            String v = record.get(header);
            return v != null ? v.trim() : "";
        } catch (IllegalArgumentException | IllegalStateException e) {
            return "";
        }
    }
}
