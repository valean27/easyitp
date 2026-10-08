package org.example.easyitp.service;

import java.time.LocalDate;
import java.time.Month;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;

// Zilele de sarbatoare legala din Romania (Codul muncii, art. 139), cu numele lor.
// Pastele si Rusaliile sunt cele ortodoxe: Vinerea Mare, Pastele si a doua zi, Rusaliile si a doua zi.
public final class RomanianHolidays {

    private RomanianHolidays() {
    }

    public static Map<LocalDate, String> of(int year) {
        Map<LocalDate, String> days = new TreeMap<>();
        days.put(LocalDate.of(year, Month.JANUARY, 1), "Anul Nou");
        days.put(LocalDate.of(year, Month.JANUARY, 2), "Anul Nou");
        days.put(LocalDate.of(year, Month.JANUARY, 6), "Boboteaza");
        days.put(LocalDate.of(year, Month.JANUARY, 7), "Sfântul Ioan");
        days.put(LocalDate.of(year, Month.JANUARY, 24), "Ziua Unirii Principatelor");
        days.put(LocalDate.of(year, Month.MAY, 1), "Ziua Muncii");
        days.put(LocalDate.of(year, Month.JUNE, 1), "Ziua Copilului");
        days.put(LocalDate.of(year, Month.AUGUST, 15), "Adormirea Maicii Domnului");
        days.put(LocalDate.of(year, Month.NOVEMBER, 30), "Sfântul Andrei");
        days.put(LocalDate.of(year, Month.DECEMBER, 1), "Ziua Națională");
        days.put(LocalDate.of(year, Month.DECEMBER, 25), "Crăciunul");
        days.put(LocalDate.of(year, Month.DECEMBER, 26), "Crăciunul");
        LocalDate easter = orthodoxEaster(year);
        // putIfAbsent: daca Pastele cade pe 1 mai sau 1 iunie, ramane numele zilei fixe
        days.putIfAbsent(easter.minusDays(2), "Vinerea Mare");
        days.putIfAbsent(easter, "Paștele");
        days.putIfAbsent(easter.plusDays(1), "Paștele");
        days.putIfAbsent(easter.plusDays(49), "Rusaliile");
        days.putIfAbsent(easter.plusDays(50), "Rusaliile");
        return days;
    }

    // Sarbatorile din intervalul [from, to], in ordine
    public static Map<LocalDate, String> between(LocalDate from, LocalDate to) {
        Map<LocalDate, String> result = new LinkedHashMap<>();
        for (int y = from.getYear(); y <= to.getYear(); y++) {
            of(y).forEach((d, name) -> {
                if (!d.isBefore(from) && !d.isAfter(to)) result.put(d, name);
            });
        }
        return result;
    }

    // Numele sarbatorii din ziua data (null = zi obisnuita)
    public static String nameOf(LocalDate date) {
        return of(date.getYear()).get(date);
    }

    // Pastele ortodox: algoritmul lui Meeus pentru calendarul iulian, trecut in calendarul gregorian (+13 zile, 1900-2099)
    static LocalDate orthodoxEaster(int year) {
        int a = year % 4;
        int b = year % 7;
        int c = year % 19;
        int d = (19 * c + 15) % 30;
        int e = (2 * a + 4 * b - d + 34) % 7;
        int month = (d + e + 114) / 31;
        int day = (d + e + 114) % 31 + 1;
        return LocalDate.of(year, month, day).plusDays(13);
    }
}
