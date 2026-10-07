package org.example.easyitp.service;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

// Liniile ITP ale unei zile: programarile cu linie o pastreaza, cele fara linie (vechi) primesc prima linie libera
// in ordinea orei, iar o programare noua primeste linia preferata daca e libera, altfel prima linie libera.
public final class LinePlanner {

    public record Booked(Long id, LocalDateTime start, LocalDateTime end, Integer line) {
    }

    private LinePlanner() {
    }

    // id -> linia efectiva (null = nu mai incape pe nicio linie, peste capacitate)
    public static Map<Long, Integer> assign(List<Booked> booked, int lines) {
        Map<Long, Integer> result = new HashMap<>();
        List<Booked> placed = new java.util.ArrayList<>();
        for (Booked b : booked) {
            if (b.line() != null) {
                result.put(b.id(), b.line());
                placed.add(b);
            }
        }
        List<Booked> loose = booked.stream().filter(b -> b.line() == null)
                .sorted(Comparator.comparing(Booked::start).thenComparing(Booked::id, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        for (Booked b : loose) {
            Integer line = firstFree(placed, lines, b.start(), b.end(), null);
            result.put(b.id(), line);
            if (line != null) placed.add(new Booked(b.id(), b.start(), b.end(), line));
        }
        return result;
    }

    // Linia libera pentru [start, end): cea preferata daca e libera, altfel prima libera; null = toate ocupate
    public static Integer freeLine(List<Booked> booked, int lines, LocalDateTime start, LocalDateTime end, Integer preferred) {
        Map<Long, Integer> effective = assign(booked, lines);
        List<Booked> placed = booked.stream()
                .filter(b -> effective.get(b.id()) != null)
                .map(b -> new Booked(b.id(), b.start(), b.end(), effective.get(b.id())))
                .toList();
        return firstFree(placed, lines, start, end, preferred);
    }

    private static Integer firstFree(List<Booked> placed, int lines, LocalDateTime start, LocalDateTime end, Integer preferred) {
        if (preferred != null && preferred >= 1 && preferred <= lines && free(placed, preferred, start, end)) return preferred;
        for (int line = 1; line <= lines; line++) {
            if (free(placed, line, start, end)) return line;
        }
        return null;
    }

    private static boolean free(List<Booked> placed, int line, LocalDateTime start, LocalDateTime end) {
        return placed.stream().noneMatch(b -> Objects.equals(b.line(), line) && b.start().isBefore(end) && b.end().isAfter(start));
    }
}
