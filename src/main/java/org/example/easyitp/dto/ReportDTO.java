package org.example.easyitp.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
@AllArgsConstructor
public class ReportDTO {
    private int year;
    private List<Integer> availableYears;
    private List<Month> months;
    private List<BrandCount> topBrands;
    // ITP-urile fiecarui inspector, pe luni (gol pentru admin: vede doar cifre agregate)
    private List<InspectorMonth> inspectors;
    private Retention retention;

    @Data
    @AllArgsConstructor
    public static class Month {
        private int month; // 1-12
        private long count;
        private double revenue;
        private long passed;
        private long failed;
        private long recheck;
    }

    @Data
    @AllArgsConstructor
    public static class BrandCount {
        private String brand;
        private long count;
    }

    @Data
    @AllArgsConstructor
    public static class InspectorMonth {
        private String inspector; // "Nespecificat" pentru ITP-urile fara inspector
        private int month;        // 1-12
        private long count;
        private long failed;
        private long recheck;
        private double revenue;
    }

    // Vehiculele cu ITP la statie in anul anterior: cate au revenit in anul raportului, la scadenta
    @Data
    @AllArgsConstructor
    public static class Retention {
        private int previousYear;
        private long due;        // au ajuns la scadenta pana azi (sau pana la sfarsitul anului raportului)
        private long returned;   // dintre ele, au facut un ITP nou in anul raportului
        private long notDueYet;  // ITP-ul lor e inca valabil
        private List<LostClient> lost; // cele care nu au revenit (gol pentru admin)
    }

    @Data
    @AllArgsConstructor
    public static class LostClient {
        private String plate;
        private String name;
        private String phone;
        private LocalDate lastItpDate;
        private LocalDate expiredOn;
    }
}
