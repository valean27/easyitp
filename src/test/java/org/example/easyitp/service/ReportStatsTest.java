package org.example.easyitp.service;

import org.example.easyitp.dto.ReportDTO;
import org.example.easyitp.entity.Client;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.entity.ItpStatus;
import org.example.easyitp.entity.Vehicle;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// Statisticile noi din Rapoarte: clasamentul inspectorilor si clientii care nu au revenit
class ReportStatsTest {

    private final List<ItpRecord> records = new ArrayList<>();

    private void itp(String plate, LocalDate date, int months, ItpStatus status, String inspector, double price) {
        Client client = Client.builder().name("Client " + plate).phone("0722").build();
        Vehicle vehicle = Vehicle.builder().licensePlate(plate).client(client).build();
        records.add(ItpRecord.builder().vehicle(vehicle).testDate(date).validityMonths(months)
                .nextItpDate(date.plusMonths(months)).status(status).inspector(inspector).price(price).build());
    }

    @Test
    void groupsInspectionsByInspectorAndMonth() {
        itp("CJ01AAA", LocalDate.of(2026, 3, 2), 12, ItpStatus.PASSED, "Ion", 150);
        itp("CJ02AAA", LocalDate.of(2026, 3, 9), 12, ItpStatus.FAILED, "Ion", 150);
        itp("CJ03AAA", LocalDate.of(2026, 3, 9), 12, ItpStatus.PASSED, " ", 100);
        itp("CJ04AAA", LocalDate.of(2025, 3, 9), 12, ItpStatus.PASSED, "Ion", 100); // alt an

        List<ReportDTO.InspectorMonth> rows = ReportService.inspectorMonths(records, 2026);

        assertThat(rows).hasSize(2);
        ReportDTO.InspectorMonth ion = rows.get(0);
        assertThat(ion.getInspector()).isEqualTo("Ion");
        assertThat(ion.getMonth()).isEqualTo(3);
        assertThat(ion.getCount()).isEqualTo(2);
        assertThat(ion.getFailed()).isEqualTo(1);
        assertThat(ion.getRevenue()).isEqualTo(300.0);
        assertThat(rows.get(1).getInspector()).isEqualTo("Nespecificat");
    }

    @Test
    void countsVehiclesThatCameBackAtExpiry() {
        LocalDate today = LocalDate.of(2026, 10, 3);
        itp("CJ 01 REV", LocalDate.of(2025, 2, 1), 12, ItpStatus.PASSED, null, 0);   // a revenit
        itp("CJ01REV", LocalDate.of(2026, 2, 3), 12, ItpStatus.PASSED, null, 0);
        itp("CJ 02 PIE", LocalDate.of(2025, 5, 1), 12, ItpStatus.PASSED, null, 0);   // pierdut (expirat in mai)
        itp("CJ 03 PIE", LocalDate.of(2025, 8, 1), 12, ItpStatus.PASSED, null, 0);   // pierdut (expirat in august)
        itp("CJ 04 VAL", LocalDate.of(2025, 11, 1), 12, ItpStatus.PASSED, null, 0);  // inca valabil
        itp("CJ 05 DOI", LocalDate.of(2025, 3, 1), 24, ItpStatus.PASSED, null, 0);   // valabil 2 ani
        itp("CJ 06 NOU", LocalDate.of(2026, 4, 1), 12, ItpStatus.PASSED, null, 0);   // client nou, nu conteaza

        ReportDTO.Retention r = ReportService.retention(records, 2026, today, true);

        assertThat(r.getPreviousYear()).isEqualTo(2025);
        assertThat(r.getDue()).isEqualTo(3);
        assertThat(r.getReturned()).isEqualTo(1);
        assertThat(r.getNotDueYet()).isEqualTo(2);
        assertThat(r.getLost()).extracting(ReportDTO.LostClient::getPlate).containsExactly("CJ 03 PIE", "CJ 02 PIE");

        // fara lista (admin): doar cifrele
        assertThat(ReportService.retention(records, 2026, today, false).getLost()).isEmpty();
    }
}
