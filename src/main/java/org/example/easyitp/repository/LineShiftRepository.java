package org.example.easyitp.repository;

import org.example.easyitp.entity.LineShift;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface LineShiftRepository extends JpaRepository<LineShift, Long> {

    List<LineShift> findByUserIdAndDayBetween(Long userId, LocalDate from, LocalDate to);

    Optional<LineShift> findByUserIdAndDayAndLine(Long userId, LocalDate day, Integer line);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE LineShift s SET s.inspectorId = null WHERE s.inspectorId = :id")
    void unlinkInspector(@Param("id") Long id);
}
