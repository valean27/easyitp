package org.example.easyitp.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class CsvImportParsingTest {

    @Test
    void parsesRomanianExcelDates() {
        assertThat(CsvImportService.parseDate("9-mar.-2026")).isEqualTo(LocalDate.of(2026, 3, 9));
        assertThat(CsvImportService.parseDate("10-sept.-2026")).isEqualTo(LocalDate.of(2026, 9, 10));
        assertThat(CsvImportService.parseDate("11-mai-2026")).isEqualTo(LocalDate.of(2026, 5, 11));
        assertThat(CsvImportService.parseDate("1-iun.-2026")).isEqualTo(LocalDate.of(2026, 6, 1));
        assertThat(CsvImportService.parseDate("3 noi. 2026")).isEqualTo(LocalDate.of(2026, 11, 3));
    }

    @Test
    void parsesNumericDatesAndRejectsGarbage() {
        assertThat(CsvImportService.parseDate("09.03.2026")).isEqualTo(LocalDate.of(2026, 3, 9));
        assertThat(CsvImportService.parseDate("2026-03-09")).isEqualTo(LocalDate.of(2026, 3, 9));
        assertThat(CsvImportService.parseDate("31-feb.-2026")).isNull();
        assertThat(CsvImportService.parseDate("-")).isNull();
        assertThat(CsvImportService.parseDate("")).isNull();
    }

    @Test
    void restoresLeadingZeroRemovedByExcel() {
        assertThat(CsvImportService.normalizePhone("739963246")).isEqualTo("0739963246");
        assertThat(CsvImportService.normalizePhone("0739963246")).isEqualTo("0739963246");
        assertThat(CsvImportService.normalizePhone("+40 739 963 246")).isEqualTo("+40 739 963 246");
        assertThat(CsvImportService.normalizePhone("")).isNull();
    }

    @Test
    void parsesValidity() {
        assertThat(CsvImportService.parseValidity("12")).isEqualTo(12);
        assertThat(CsvImportService.parseValidity("24 luni")).isEqualTo(24);
        assertThat(CsvImportService.parseValidity("0")).isNull();
        assertThat(CsvImportService.parseValidity("abc")).isNull();
    }
}
