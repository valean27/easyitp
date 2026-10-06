package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.ReportDTO;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.entity.ItpStatus;
import org.example.easyitp.entity.Role;
import org.example.easyitp.entity.Vehicle;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.AppointmentRepository;
import org.example.easyitp.entity.AppointmentStatus;
import org.example.easyitp.repository.ItpRecordRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.TreeSet;

@Service
@RequiredArgsConstructor
public class ReportService {

    private static final int TOP_BRANDS = 8;
    private static final int MAX_LOST = 200;
    static final String UNKNOWN_INSPECTOR = "Nespecificat";
    private static final DateTimeFormatter RO_DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    private final ItpRecordRepository itpRecordRepository;
    private final AppUserRepository appUserRepository;
    private final AppointmentRepository appointmentRepository;

    // Managerul vede doar statia lui; adminul vede toate statiile (null) sau una anume (stationId)
    private Long scope(AppUser user, Long stationId) {
        if (user.getRole() != Role.ADMIN) return user.getId();
        if (stationId != null) {
            appUserRepository.findById(stationId)
                    .filter(u -> u.getRole() == Role.MANAGER)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Statie inexistenta"));
        }
        return stationId;
    }

    // Doar ITP-urile din interval (nu toata baza)
    private List<ItpRecord> recordsFor(Long stationId, LocalDate from, LocalDate to) {
        return stationId != null
                ? itpRecordRepository.findByUserIdAndTestDateBetween(stationId, from, to)
                : itpRecordRepository.findAllStationsTestDateBetween(from, to);
    }

    @Transactional(readOnly = true)
    public ReportDTO yearReport(AppUser user, Long stationId, int year) {
        Long station = scope(user, stationId);
        // anul raportului + anul dinainte (pentru clientii care au revenit)
        List<ItpRecord> records = recordsFor(station, LocalDate.of(year - 1, 1, 1), LocalDate.of(year, 12, 31));

        TreeSet<Integer> years = new TreeSet<>(Comparator.reverseOrder());
        years.add(LocalDate.now().getYear());
        years.addAll(itpRecordRepository.distinctYears(station));

        long[] count = new long[12], passed = new long[12], failed = new long[12], recheck = new long[12];
        double[] revenue = new double[12];
        Map<String, Long> brands = new HashMap<>();

        for (ItpRecord r : records) {
            if (r.getTestDate().getYear() != year) continue;
            int m = r.getTestDate().getMonthValue() - 1;
            count[m]++;
            revenue[m] += r.getPrice() != null ? r.getPrice() : 0.0;
            ItpStatus status = r.getStatus() != null ? r.getStatus() : ItpStatus.PASSED;
            switch (status) {
                case PASSED -> passed[m]++;
                case FAILED -> failed[m]++;
                case RECHECK -> recheck[m]++;
            }
            String brand = r.getVehicle().getBrand();
            brands.merge(brand == null || brand.isBlank() ? "Necunoscut" : brand.trim(), 1L, Long::sum);
        }

        List<ReportDTO.Month> months = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            months.add(new ReportDTO.Month(i + 1, count[i], revenue[i], passed[i], failed[i], recheck[i]));
        }
        List<ReportDTO.BrandCount> topBrands = brands.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(TOP_BRANDS)
                .map(e -> new ReportDTO.BrandCount(e.getKey(), e.getValue()))
                .toList();

        // Adminul vede doar cifre agregate: fara nume de inspectori si fara lista de clienti
        boolean admin = user.getRole() == Role.ADMIN;
        // Pe Gratuit: doar lunile si marcile (inspectorii, clientii pierduti si programarile sunt in Pro)
        if (!admin && !Plans.allows(user, Plans.Feature.OWNER_REPORTS)) {
            return new ReportDTO(year, new ArrayList<>(years), months, topBrands, List.of(), null, null);
        }
        return new ReportDTO(year, new ArrayList<>(years), months, topBrands,
                admin ? List.of() : inspectorMonths(records, year),
                retention(records, year, LocalDate.now(), !admin),
                appointmentStats(station, year));
    }

    private ReportDTO.AppointmentStats appointmentStats(Long station, int year) {
        java.time.LocalDateTime from = LocalDate.of(year, 1, 1).atStartOfDay();
        java.time.LocalDateTime to = from.plusYears(1);
        Map<AppointmentStatus, Long> byStatus = new HashMap<>();
        for (Object[] row : appointmentRepository.countByStatus(station, from, to)) {
            byStatus.put((AppointmentStatus) row[0], ((Number) row[1]).longValue());
        }
        long total = byStatus.values().stream().mapToLong(Long::longValue).sum();
        return new ReportDTO.AppointmentStats(total, byStatus.getOrDefault(AppointmentStatus.COMPLETED, 0L),
                byStatus.getOrDefault(AppointmentStatus.NO_SHOW, 0L), byStatus.getOrDefault(AppointmentStatus.CANCELLED, 0L),
                appointmentRepository.countCancelledByClient(station, from, to));
    }

    static List<ReportDTO.InspectorMonth> inspectorMonths(List<ItpRecord> records, int year) {
        // cheie: inspector + luna
        Map<String, ReportDTO.InspectorMonth> rows = new LinkedHashMap<>();
        for (ItpRecord r : records) {
            if (r.getTestDate().getYear() != year) continue;
            String name = r.getInspector() == null || r.getInspector().isBlank() ? UNKNOWN_INSPECTOR : r.getInspector().trim();
            int month = r.getTestDate().getMonthValue();
            ReportDTO.InspectorMonth row = rows.computeIfAbsent(name + "|" + month,
                    k -> new ReportDTO.InspectorMonth(name, month, 0, 0, 0, 0));
            row.setCount(row.getCount() + 1);
            if (r.getStatus() == ItpStatus.FAILED) row.setFailed(row.getFailed() + 1);
            if (r.getStatus() == ItpStatus.RECHECK) row.setRecheck(row.getRecheck() + 1);
            row.setRevenue(row.getRevenue() + (r.getPrice() != null ? r.getPrice() : 0.0));
        }
        return new ArrayList<>(rows.values());
    }

    // Vehiculele (dupa numar) cu ITP in anul dinaintea raportului: cate au revenit in anul raportului.
    // Le numaram doar pe cele ajunse la scadenta, ca un ITP valabil 2 ani sa nu apara drept client pierdut.
    static ReportDTO.Retention retention(List<ItpRecord> records, int year, LocalDate today, boolean withList) {
        int previousYear = year - 1;
        LocalDate endOfYear = LocalDate.of(year, 12, 31);
        LocalDate cutoff = today.isBefore(endOfYear) ? today : endOfYear;

        Map<String, List<ItpRecord>> byVehicle = new HashMap<>();
        for (ItpRecord r : records) {
            byVehicle.computeIfAbsent(PlateUtils.normalize(r.getVehicle().getLicensePlate()), k -> new ArrayList<>()).add(r);
        }

        long due = 0, returned = 0, notDueYet = 0;
        List<ReportDTO.LostClient> lost = new ArrayList<>();
        for (List<ItpRecord> vehicleRecords : byVehicle.values()) {
            ItpRecord lastPrevious = vehicleRecords.stream()
                    .filter(r -> r.getTestDate().getYear() == previousYear)
                    .max(Comparator.comparing(ItpRecord::getTestDate))
                    .orElse(null);
            if (lastPrevious == null) continue;
            if (lastPrevious.getNextItpDate().isAfter(cutoff)) {
                notDueYet++;
                continue;
            }
            due++;
            boolean cameBack = vehicleRecords.stream().anyMatch(r -> r.getTestDate().getYear() == year);
            if (cameBack) {
                returned++;
            } else if (withList) {
                Vehicle v = lastPrevious.getVehicle();
                lost.add(new ReportDTO.LostClient(v.getLicensePlate(), v.getClient().getName(), v.getClient().getPhone(),
                        lastPrevious.getTestDate(), lastPrevious.getNextItpDate()));
            }
        }
        // Cei pierduti de curand primii: mai pot fi recuperati cu un telefon
        lost.sort(Comparator.comparing(ReportDTO.LostClient::getExpiredOn).reversed());
        return new ReportDTO.Retention(previousYear, due, returned, notDueYet,
                lost.size() > MAX_LOST ? lost.subList(0, MAX_LOST) : lost);
    }

    // CSV pentru contabilitate: separator ";" si zecimale cu virgula, ca sa se deschida corect in Excel romanesc
    @Transactional(readOnly = true)
    public byte[] exportCsv(AppUser user, Long stationId, LocalDate from, LocalDate to) {
        boolean admin = user.getRole() == Role.ADMIN;
        boolean withStation = admin && stationId == null;
        List<ItpRecord> records = recordsFor(scope(user, stationId), from, to).stream()
                .sorted(Comparator.comparing(ItpRecord::getTestDate).thenComparing(ItpRecord::getId))
                .toList();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        baos.write(0xEF);
        baos.write(0xBB);
        baos.write(0xBF);
        try (PrintWriter pw = new PrintWriter(new OutputStreamWriter(baos, StandardCharsets.UTF_8))) {
            pw.println("sep=;");
            // Adminul vede doar cifre: fara numar de inmatriculare si nume de client
            List<String> header = new ArrayList<>(admin
                    ? List.of("Data ITP", "Marca", "Model", "Rezultat", "Valabilitate (luni)", "Pret (RON)")
                    : List.of("Data ITP", "Nr. inmatriculare", "Client", "Marca", "Model",
                            "Rezultat", "Valabilitate (luni)", "Pret (RON)"));
            if (withStation) header.add(0, "Statie");
            pw.println(String.join(";", header));

            double total = 0;
            for (ItpRecord r : records) {
                Vehicle v = r.getVehicle();
                double price = r.getPrice() != null ? r.getPrice() : 0.0;
                total += price;
                List<String> row = new ArrayList<>(List.of(
                        r.getTestDate().format(RO_DATE),
                        csv(v.getLicensePlate()),
                        csv(v.getClient().getName()),
                        csv(v.getBrand()),
                        csv(v.getModel()),
                        statusLabel(r.getStatus()),
                        String.valueOf(r.getValidityMonths()),
                        money(price)));
                if (admin) row.subList(1, 3).clear();
                if (withStation) {
                    AppUser owner = v.getClient().getUser();
                    row.add(0, csv(owner.getStationName() != null ? owner.getStationName() : owner.getEmail()));
                }
                pw.println(String.join(";", row));
            }
            String[] totalRow = new String[header.size()];
            Arrays.fill(totalRow, "");
            totalRow[0] = "TOTAL (" + records.size() + " ITP)";
            totalRow[header.size() - 1] = money(total);
            pw.println(String.join(";", totalRow));
        }
        return baos.toByteArray();
    }

    private static String statusLabel(ItpStatus status) {
        if (status == null) return "Promovat";
        return switch (status) {
            case PASSED -> "Promovat";
            case FAILED -> "Respins";
            case RECHECK -> "Reverificare";
        };
    }

    private static String money(double value) {
        return String.format(Locale.ROOT, "%.2f", value).replace('.', ',');
    }

    private static String csv(String value) {
        return CsvCells.cell(value, ';');
    }
}
