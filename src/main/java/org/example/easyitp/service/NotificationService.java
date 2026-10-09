package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.entity.Notification;
import org.example.easyitp.repository.NotificationRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

// Notificarile din aplicatie ale statiei: ce s-a intamplat fara manager (programari online, actiunile clientilor si
// ale inspectorilor). Se pastreaza 90 de zile.
@Service
@RequiredArgsConstructor
public class NotificationService {

    static final int LIST_LIMIT = 30;
    static final int KEEP_DAYS = 90;

    private final NotificationRepository repository;
    private final PushService pushService;

    public record NotificationDTO(Long id, String kind, String title, String body, String link, LocalDateTime createdAt, boolean read) {
    }

    public record Inbox(long unread, List<NotificationDTO> items) {
    }

    // In tranzactia celui care o creeaza: daca programarea nu se salveaza, nici notificarea
    @Transactional(propagation = Propagation.REQUIRED)
    public void add(Long stationId, Notification.Kind kind, String title, String body, String link) {
        repository.save(Notification.builder()
                .userId(stationId)
                .kind(kind)
                .title(trim(title, 200))
                .body(body == null ? null : trim(body, 500))
                .link(link == null ? null : trim(link, 300))
                .createdAt(LocalDateTime.now())
                .build());
        // si pe telefonul / calculatorul managerului, daca a pornit notificarile push (dupa salvare)
        pushService.toStation(stationId, new PushService.Message(trim(title, 120), body == null ? null : trim(body, 300), link,
                kind.name()));
    }

    @Transactional(readOnly = true)
    public Inbox inbox(Long stationId) {
        List<NotificationDTO> items = repository.findByUserIdOrderByCreatedAtDescIdDesc(stationId, PageRequest.of(0, LIST_LIMIT)).stream()
                .map(n -> new NotificationDTO(n.getId(), n.getKind().name(), n.getTitle(), n.getBody(), n.getLink(), n.getCreatedAt(),
                        n.getReadAt() != null))
                .toList();
        return new Inbox(repository.countByUserIdAndReadAtIsNull(stationId), items);
    }

    @Transactional(readOnly = true)
    public long unread(Long stationId) {
        return repository.countByUserIdAndReadAtIsNull(stationId);
    }

    @Transactional
    public void markRead(Long stationId, Long id) {
        repository.findByIdAndUserId(id, stationId).ifPresent(n -> {
            if (n.getReadAt() == null) n.setReadAt(LocalDateTime.now());
        });
    }

    @Transactional
    public void markAllRead(Long stationId) {
        repository.markAllRead(stationId, LocalDateTime.now());
    }

    // Rularea de dimineata
    @Transactional
    public int purgeOld(LocalDateTime now) {
        return repository.purgeBefore(now.minusDays(KEEP_DAYS));
    }

    private static String trim(String s, int max) {
        return s.length() > max ? s.substring(0, max - 1) + "…" : s;
    }
}
