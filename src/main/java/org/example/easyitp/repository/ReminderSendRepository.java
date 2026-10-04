package org.example.easyitp.repository;

import org.example.easyitp.entity.ReminderSend;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ReminderSendRepository extends JpaRepository<ReminderSend, Long> {

    Optional<ReminderSend> findByItpRecordIdAndStage(Long itpRecordId, Integer stage);

    List<ReminderSend> findByItpRecordIdIn(Collection<Long> itpRecordIds);

    List<ReminderSend> findByUserIdOrderBySentAtDesc(Long userId, Pageable pageable);

    long countByUserIdAndStatusAndSentAtAfter(Long userId, ReminderSend.Status status, LocalDateTime after);

    @Transactional
    void deleteByItpRecordIdIn(Collection<Long> itpRecordIds);

    @Transactional
    void deleteByUserId(Long userId);
}
