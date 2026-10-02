package org.example.easyitp.repository;

import org.example.easyitp.entity.ItpRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ItpRecordRepository extends JpaRepository<ItpRecord, Long> {

    @Query("SELECT r FROM ItpRecord r JOIN FETCH r.vehicle v JOIN FETCH v.client c WHERE c.user.id = :userId ORDER BY r.nextItpDate ASC")
    List<ItpRecord> findAllByUserId(@Param("userId") Long userId);

    @Query("SELECT r FROM ItpRecord r JOIN r.vehicle v JOIN v.client c WHERE r.id = :id AND c.user.id = :userId")
    Optional<ItpRecord> findByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);

    // [userId, total, expirate, expira in curand, ITP-uri luna asta, incasari luna asta]
    @Query("""
            SELECT c.user.id, COUNT(r),
                   SUM(CASE WHEN r.nextItpDate < :today THEN 1 ELSE 0 END),
                   SUM(CASE WHEN r.nextItpDate >= :today AND r.nextItpDate <= :soon THEN 1 ELSE 0 END),
                   SUM(CASE WHEN r.testDate >= :monthStart THEN 1 ELSE 0 END),
                   SUM(CASE WHEN r.testDate >= :monthStart THEN COALESCE(r.price, 0.0) ELSE 0.0 END)
            FROM ItpRecord r JOIN r.vehicle v JOIN v.client c
            GROUP BY c.user.id
            """)
    List<Object[]> statsByUser(@Param("today") LocalDate today,
                               @Param("soon") LocalDate soon,
                               @Param("monthStart") LocalDate monthStart);
}
