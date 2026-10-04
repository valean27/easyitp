package org.example.easyitp.repository;

import org.example.easyitp.entity.AuditEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Optional;

public interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {

    Page<AuditEvent> findByUserIdOrderByCreatedAtDescIdDesc(Long userId, Pageable pageable);

    Page<AuditEvent> findByUserIdAndActionInOrderByCreatedAtDescIdDesc(Long userId, Collection<AuditEvent.Action> actions,
                                                                       Pageable pageable);

    Optional<AuditEvent> findByIdAndUserId(Long id, Long userId);

    @Transactional
    @Modifying
    @Query("DELETE FROM AuditEvent e WHERE e.createdAt < :before")
    int deleteOlderThan(@Param("before") LocalDateTime before);

    @Transactional
    @Modifying
    @Query("DELETE FROM AuditEvent e WHERE e.userId = :userId")
    int deleteByUserId(@Param("userId") Long userId);
}
