package org.example.easyitp.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

// Echipa de inspectori a statiei: lista, liniile pe zi si dashboard-ul
public final class InspectorDTOs {

    private InspectorDTOs() {
    }

    // attestationUntil: din termenele statiei (atestatul inspectorului), null daca nu e trecut
    // schedule gol = fara program fix; login = contul propriu (null = fara cont)
    public record InspectorDTO(Long id, String name, String phone, String color, boolean active, Integer defaultLine,
                               LocalDate attestationUntil, Long attestationDaysLeft, List<DayDTO> schedule, String login) {
    }

    // O zi de lucru: 1 = luni ... 7 = duminica; line null = linia lui obisnuita; orele optionale
    public record DayDTO(int weekday, Integer line, LocalTime start, LocalTime end) {
    }

    // login gol = cel propus (prenume.nume@statie); password gol = nu se schimba (obligatorie la un cont nou)
    public record AccountRequest(String login, String password) {
    }

    // attestationUntil null = sterge atestatul (se schimba doar pe Pro, cu termenele statiei)
    // schedule null = nu se schimba
    public record InspectorRequest(String name, String phone, String color, Boolean active, Integer defaultLine,
                                   LocalDate attestationUntil, List<DayDTO> schedule) {
    }

    // Cine lucreaza pe linie in ziua aleasa; source: DAY (ales pentru ziua asta), DEFAULT (linia lui obisnuita), NONE
    public record LineShiftDTO(int line, String lineName, Long inspectorId, String source) {
    }

    // reset = revine la linia obisnuita a inspectorilor; altfel inspectorId (null = nimeni pe linie in ziua asta)
    public record LineShiftRequest(LocalDate date, Integer line, Long inspectorId, boolean reset) {
    }

    // key: "id:<id>" pentru inspectorii din echipa, "name:<nume>" pentru nume vechi, "none" pentru ITP-urile fara inspector
    public record InspectorStats(String key, Long id, String name, String color, boolean active,
                                 long itps, long passed, long failed, long recheck, double revenue,
                                 long daysWorked, long appointments, long completed, long noShows,
                                 Integer todayLine, long todayAppointments, boolean offToday) {
    }

    public record DayCount(String key, long count) {
    }

    public record Day(LocalDate date, long total, List<DayCount> byInspector) {
    }

    public record Totals(long itps, double revenue, long failed, long appointments, long noShows, int activeInspectors) {
    }

    public record Dashboard(LocalDate from, LocalDate to, Totals totals, List<InspectorStats> inspectors, List<Day> days,
                            List<InspectorDTO> attestations) {
    }
}
