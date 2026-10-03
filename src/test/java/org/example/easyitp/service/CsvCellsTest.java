package org.example.easyitp.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CsvCellsTest {

    @Test
    void formulasGetAnApostrophe() {
        assertThat(CsvCells.cell("=SUM(A1)", ';')).isEqualTo("'=SUM(A1)");
        assertThat(CsvCells.cell("@cmd", ';')).isEqualTo("'@cmd");
        assertThat(CsvCells.cell("-2+3*cmd|' /C calc'!A0", ';')).startsWith("'-2");
    }

    @Test
    void phoneNumbersAndPlainTextStayTheSame() {
        assertThat(CsvCells.cell("+40 722 123 456", ';')).isEqualTo("+40 722 123 456");
        assertThat(CsvCells.cell("+40-722-123-456", ',')).isEqualTo("+40-722-123-456");
        assertThat(CsvCells.cell("Ion Popescu", ';')).isEqualTo("Ion Popescu");
        assertThat(CsvCells.cell(null, ';')).isEmpty();
    }

    @Test
    void separatorsAndQuotesAreQuoted() {
        assertThat(CsvCells.cell("a;b", ';')).isEqualTo("\"a;b\"");
        assertThat(CsvCells.cell("a,b", ';')).isEqualTo("a,b");
        assertThat(CsvCells.cell("spune \"da\"", ',')).isEqualTo("\"spune \"\"da\"\"\"");
    }
}
