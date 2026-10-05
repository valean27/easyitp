package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.StationDeadlineDTO;
import org.example.easyitp.entity.StationDeadline;
import org.example.easyitp.repository.StationDeadlineRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

// Termenele statiei (D1): o lista simpla pe statie; cele care se apropie apar in dashboard si in rezumatul zilnic
@Service
@RequiredArgsConstructor
public class StationDeadlineService {

    static final int MAX_PER_STATION = 100;

    private final StationDeadlineRepository repository;

    @Transactional(readOnly = true)
    public List<StationDeadlineDTO> list(Long userId, LocalDate today) {
        return repository.findByUserIdOrderByDueDateAsc(userId).stream().map(d -> dto(d, today)).toList();
    }

    // Doar cele care cer atentie (expirate sau in fereastra de alerta a tipului)
    @Transactional(readOnly = true)
    public List<StationDeadlineDTO> due(Long userId, LocalDate today) {
        return list(userId, today).stream().filter(StationDeadlineDTO::due).toList();
    }

    @Transactional
    public StationDeadlineDTO create(Long userId, StationDeadlineDTO.Request request) {
        validate(request);
        if (repository.findByUserIdOrderByDueDateAsc(userId).size() >= MAX_PER_STATION) throw badRequest("Prea multe termene.");
        StationDeadline d = StationDeadline.builder().userId(userId).createdAt(LocalDateTime.now()).build();
        apply(d, request);
        return dto(repository.save(d), LocalDate.now());
    }

    @Transactional
    public StationDeadlineDTO update(Long userId, Long id, StationDeadlineDTO.Request request) {
        validate(request);
        StationDeadline d = find(userId, id);
        apply(d, request);
        return dto(repository.save(d), LocalDate.now());
    }

    @Transactional
    public void delete(Long userId, Long id) {
        repository.delete(find(userId, id));
    }

    private StationDeadline find(Long userId, Long id) {
        return repository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Termenul nu există"));
    }

    private static void apply(StationDeadline d, StationDeadlineDTO.Request r) {
        d.setKind(r.kind());
        d.setTitle(trimToNull(r.title()));
        d.setDueDate(r.dueDate());
        d.setNotes(trimToNull(r.notes()));
    }

    private static void validate(StationDeadlineDTO.Request r) {
        if (r.kind() == null) throw badRequest("Alegeți tipul termenului.");
        if (r.dueDate() == null) throw badRequest("Introduceți data expirării.");
        if (r.dueDate().isBefore(LocalDate.of(2000, 1, 1)) || r.dueDate().isAfter(LocalDate.now().plusYears(20))) {
            throw badRequest("Data expirării nu este validă.");
        }
        if (r.title() != null && r.title().trim().length() > 120) throw badRequest("Denumirea este prea lungă.");
        if (r.notes() != null && r.notes().trim().length() > 300) throw badRequest("Observațiile sunt prea lungi.");
    }

    static StationDeadlineDTO dto(StationDeadline d, LocalDate today) {
        long days = ChronoUnit.DAYS.between(today, d.getDueDate());
        return new StationDeadlineDTO(d.getId(), d.getKind(), d.getKind().label(), d.getTitle(), d.getDueDate(), days,
                d.getNotes(), days <= d.getKind().warnDays());
    }

    private static String trimToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
