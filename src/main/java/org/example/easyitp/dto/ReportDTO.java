package org.example.easyitp.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class ReportDTO {
    private int year;
    private List<Integer> availableYears;
    private List<Month> months;
    private List<BrandCount> topBrands;

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
}
