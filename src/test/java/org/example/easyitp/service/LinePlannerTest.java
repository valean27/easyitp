package org.example.easyitp.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class LinePlannerTest {

    private static final LocalDateTime NINE = LocalDateTime.of(2026, 10, 12, 9, 0);

    private static LinePlanner.Booked at(long id, int fromMinute, int minutes, Integer line) {
        return new LinePlanner.Booked(id, NINE.plusMinutes(fromMinute), NINE.plusMinutes(fromMinute + minutes), line);
    }

    @Test
    void oldAppointmentsWithoutALineTakeTheFirstFreeOne() {
        Map<Long, Integer> lines = LinePlanner.assign(List.of(
                at(1, 0, 20, null), at(2, 0, 20, null), at(3, 10, 20, 1), at(4, 30, 20, null)), 2);
        // 3 sta pe linia 1, deci 1 si 2 (vechi) incap: 1 -> linia 2, 2 -> peste capacitate
        assertThat(lines.get(3L)).isEqualTo(1);
        assertThat(lines.get(1L)).isEqualTo(2);
        assertThat(lines.get(2L)).isNull();
        assertThat(lines.get(4L)).isEqualTo(1);
    }

    @Test
    void aNewAppointmentNeedsOneLineFreeForTheWholeInterval() {
        // linia 1 ocupata 9:00-9:20, linia 2 ocupata 9:20-9:40: 9:10-9:30 nu incape pe nicio linie
        List<LinePlanner.Booked> booked = List.of(at(1, 0, 20, 1), at(2, 20, 20, 2));
        assertThat(LinePlanner.freeLine(booked, 2, NINE.plusMinutes(10), NINE.plusMinutes(30), null)).isNull();
        assertThat(LinePlanner.freeLine(booked, 2, NINE.plusMinutes(20), NINE.plusMinutes(40), null)).isEqualTo(1);
        // linia preferata, daca e libera
        assertThat(LinePlanner.freeLine(booked, 3, NINE.plusMinutes(40), NINE.plusMinutes(60), 2)).isEqualTo(2);
        assertThat(LinePlanner.freeLine(booked, 3, NINE, NINE.plusMinutes(20), 1)).isEqualTo(2);
    }
}
