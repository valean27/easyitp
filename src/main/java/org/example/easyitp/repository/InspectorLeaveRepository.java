package org.example.easyitp.repository;

import org.example.easyitp.entity.InspectorLeave;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface InspectorLeaveRepository extends JpaRepository<InspectorLeave, Long> {

    List<InspectorLeave> findByUserIdAndDateBetweenOrderByDateAsc(Long userId, LocalDate from, LocalDate to);

    List<InspectorLeave> findByInspectorIdAndDateBetweenOrderByDateAsc(Long inspectorId, LocalDate from, LocalDate to);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM InspectorLeave l WHERE l.inspectorId = :id AND l.date BETWEEN :from AND :to")
    int deleteRange(@Param("id") Long inspectorId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM InspectorLeave l WHERE l.inspectorId = :id")
    void deleteByInspector(@Param("id") Long inspectorId);
}
