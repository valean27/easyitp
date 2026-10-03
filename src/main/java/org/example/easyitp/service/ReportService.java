package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.ReportDTO;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.entity.ItpStatus;
import org.example.easyitp.entity.Role;
import org.example.easyitp.entity.Vehicle;
import org.example.easyitp.repository.AppUserRepository;
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
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.TreeSet;

@Service
@RequiredArgsConstructor
public class ReportService {

    private static final int TOP_BRANDS = 8;
    private static final DateTimeFormatter RO_DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    private final ItpRecordRepository itpRecordRepository;
    private final AppUserRepository appUserRepository;

    // Managerul vede doar statia lui; adminul vede toate statiile sau una anume (stationId)
    private List<ItpRecord> recordsFor(AppUser user, Long stationId) {
        if (user.getRole() != Role.ADMIN) {
            return itpRecordRepository.findAllByUserId(user.getId());
        }
        if (stationId != null) {
            appUserRepository.findById(stationId)
                    .filter(u -> u.getRole() == Role.MANAGER)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Statie inexistenta"));
            return itpRecordRepository.findAllByUserId(stationId);
        }
        // Clientii vechi fara manager nu apartin niciunei statii
        return itpRecordRepository.findAllWithVehicle().stream()
                .filter(r -> r.getVehicle().getClient().getUser() != null)
                .toList();
    }

    public ReportDTO yearReport(AppUser user, Long stationId, int year) {
        List<ItpRecord> records = recordsFor(user, stationId);

        TreeSet<Integer> years = new TreeSet<>(Comparator.reverseOrder());
        years.add(LocalDate.now().getYear());
        records.forEach(r -> years.add(r.getTestDate().getYear()));

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

        return new ReportDTO(year, new ArrayList<>(years), months, topBrands);
    }

    // CSV pentru contabilitate: separator ";" si zecimale cu virgula, ca sa se deschida corect in Excel romanesc
    @Transactional(readOnly = true)
    public byte[] exportCsv(AppUser user, Long stationId, LocalDate from, LocalDate to) {
        boolean withStation = user.getRole() == Role.ADMIN && stationId == null;
        List<ItpRecord> records = recordsFor(user, stationId).stream()
                .filter(r -> !r.getTestDate().isBefore(from) && !r.getTestDate().isAfter(to))
                .sorted(Comparator.comparing(ItpRecord::getTestDate).thenComparing(ItpRecord::getId))
                .toList();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        baos.write(0xEF);
        baos.write(0xBB);
        baos.write(0xBF);
        try (PrintWriter pw = new PrintWriter(new OutputStreamWriter(baos, StandardCharsets.UTF_8))) {
            pw.println("sep=;");
            List<String> header = new ArrayList<>(List.of("Data ITP", "Nr. inmatriculare", "Client", "Marca", "Model",
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
        String v = Objects.toString(value, "");
        if (v.contains(";") || v.contains("\"") || v.contains("\n")) {
            return "\"" + v.replace("\"", "\"\"") + "\"";
        }
        return v;
    }
}
