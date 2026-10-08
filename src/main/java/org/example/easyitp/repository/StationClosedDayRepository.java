package org.example.easyitp.repository;

import org.example.easyitp.entity.StationClosedDay;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface StationClosedDayRepository extends JpaRepository<StationClosedDay, Long> {

    List<StationClosedDay> findByUserIdAndDateBetweenOrderByDateAsc(Long userId, LocalDate from, LocalDate to);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM StationClosedDay d WHERE d.userId = :userId AND d.date BETWEEN :from AND :to")
    int deleteRange(@Param("userId") Long userId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    // Zilele trecute nu mai folosesc la nimic (rularea de dimineata le sterge)
    @Modifying
    @Query("DELETE FROM StationClosedDay d WHERE d.date < :before")
    int deleteBefore(@Param("before") LocalDate before);
}
