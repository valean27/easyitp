package org.example.easyitp.repository;

import org.example.easyitp.entity.Notification;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByUserIdOrderByCreatedAtDescIdDesc(Long userId, Pageable page);

    long countByUserIdAndReadAtIsNull(Long userId);

    Optional<Notification> findByIdAndUserId(Long id, Long userId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE Notification n SET n.readAt = :now WHERE n.userId = :userId AND n.readAt IS NULL")
    int markAllRead(@Param("userId") Long userId, @Param("now") LocalDateTime now);

    @Modifying
    @Query("DELETE FROM Notification n WHERE n.createdAt < :before")
    int purgeBefore(@Param("before") LocalDateTime before);
}
