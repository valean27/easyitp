package org.example.easyitp.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class RomanianHolidaysTest {

    @Test
    void orthodoxEasterMatchesTheCalendar() {
        assertThat(RomanianHolidays.orthodoxEaster(2024)).isEqualTo(LocalDate.of(2024, 5, 5));
        assertThat(RomanianHolidays.orthodoxEaster(2025)).isEqualTo(LocalDate.of(2025, 4, 20));
        assertThat(RomanianHolidays.orthodoxEaster(2026)).isEqualTo(LocalDate.of(2026, 4, 12));
        assertThat(RomanianHolidays.orthodoxEaster(2027)).isEqualTo(LocalDate.of(2027, 5, 2));
    }

    @Test
    void yearHasFixedAndMovableHolidays() {
        var y2026 = RomanianHolidays.of(2026);
        assertThat(y2026.get(LocalDate.of(2026, 12, 1))).isEqualTo("Ziua Națională");
        assertThat(y2026.get(LocalDate.of(2026, 1, 7))).isEqualTo("Sfântul Ioan");
        assertThat(y2026.get(LocalDate.of(2026, 4, 10))).isEqualTo("Vinerea Mare");
        assertThat(y2026.get(LocalDate.of(2026, 4, 13))).isEqualTo("Paștele");
        assertThat(y2026.get(LocalDate.of(2026, 5, 31))).isEqualTo("Rusaliile");
        // a doua zi de Rusalii cade pe 1 iunie: ramane Ziua Copilului, o singura zi libera
        assertThat(y2026.get(LocalDate.of(2026, 6, 1))).isEqualTo("Ziua Copilului");
        assertThat(y2026).hasSize(16);
        // 2027: Vinerea Mare pe 30 aprilie, Pastele pe 2 mai, 1 mai ramane Ziua Muncii
        var y2027 = RomanianHolidays.of(2027);
        assertThat(y2027.get(LocalDate.of(2027, 4, 30))).isEqualTo("Vinerea Mare");
        assertThat(y2027.get(LocalDate.of(2027, 5, 1))).isEqualTo("Ziua Muncii");
        assertThat(y2027).hasSize(17);
    }

    @Test
    void betweenSpansYears() {
        var days = RomanianHolidays.between(LocalDate.of(2026, 12, 20), LocalDate.of(2027, 1, 10));
        assertThat(days.keySet()).containsExactly(LocalDate.of(2026, 12, 25), LocalDate.of(2026, 12, 26),
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 1, 2), LocalDate.of(2027, 1, 6), LocalDate.of(2027, 1, 7));
        assertThat(RomanianHolidays.nameOf(LocalDate.of(2026, 10, 9))).isNull();
    }
}
