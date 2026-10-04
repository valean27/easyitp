package org.example.easyitp.repository;

import org.example.easyitp.entity.ItpRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ItpRecordRepository extends JpaRepository<ItpRecord, Long> {

    // "r e ultimul ITP al vehiculului": niciun alt ITP al aceleiasi statii, pe acelasi numar normalizat
    // (sau acelasi vehicul, cand numarul e gol), nu e mai nou (data ITP, apoi id).
    // Egalitatea pe numar sta separat (nu intr-un OR), ca Postgres sa poata folosi indexul.
    String LATEST = """
            NOT EXISTS (SELECT 1 FROM ItpRecord r2 JOIN r2.vehicle v2 JOIN v2.client c2
                WHERE c2.user = c.user
                  AND v2.normalizedPlate = v.normalizedPlate AND (v.normalizedPlate <> '' OR v2.id = v.id)
                  AND (r2.testDate > r.testDate OR (r2.testDate = r.testDate AND r2.id > r.id)))
            """;

    String SEARCH = """
            (:like = ''
               OR LOWER(c.name) LIKE :like ESCAPE '!'
               OR LOWER(v.brand) LIKE :like ESCAPE '!'
               OR LOWER(COALESCE(v.vin, '')) LIKE :like ESCAPE '!'
               OR (:plateLike <> '' AND v.normalizedPlate LIKE :plateLike ESCAPE '!'))
            """;

    // Toata statia (exportul CSV)
    @Query("SELECT r FROM ItpRecord r JOIN FETCH r.vehicle v JOIN FETCH v.client c WHERE c.user.id = :userId ORDER BY r.nextItpDate ASC")
    List<ItpRecord> findAllByUserId(@Param("userId") Long userId);

    // Dashboard paginat: cautare dupa nume, marca, VIN sau numar (fara spatii), optional doar ultimul ITP pe vehicul
    @Query(value = "SELECT r FROM ItpRecord r JOIN FETCH r.vehicle v JOIN FETCH v.client c WHERE c.user.id = :userId"
            + " AND (:onlyLatest = false OR " + LATEST + ") AND " + SEARCH
            + " ORDER BY r.nextItpDate ASC, r.id ASC",
            countQuery = "SELECT COUNT(r) FROM ItpRecord r JOIN r.vehicle v JOIN v.client c WHERE c.user.id = :userId"
                    + " AND (:onlyLatest = false OR " + LATEST + ") AND " + SEARCH)
    Page<ItpRecord> searchStation(@Param("userId") Long userId, @Param("onlyLatest") boolean onlyLatest,
                                  @Param("like") String like, @Param("plateLike") String plateLike, Pageable pageable);

    // Care dintre aceste inregistrari sunt ultimul ITP al vehiculului lor
    @Query("SELECT r.id FROM ItpRecord r JOIN r.vehicle v JOIN v.client c WHERE c.user.id = :userId AND r.id IN :ids AND " + LATEST)
    List<Long> latestIdsAmong(@Param("userId") Long userId, @Param("ids") Collection<Long> ids);

    // Ultimul ITP al fiecarui vehicul care expira intre from si to (lista "De contactat")
    @Query("SELECT r FROM ItpRecord r JOIN FETCH r.vehicle v JOIN FETCH v.client c WHERE c.user.id = :userId"
            + " AND r.nextItpDate BETWEEN :from AND :to AND " + LATEST + " ORDER BY r.nextItpDate ASC")
    List<ItpRecord> findLatestExpiringBetween(@Param("userId") Long userId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    // Ultimul ITP al vehiculelor cu aceste numere (flote)
    @Query("SELECT r FROM ItpRecord r JOIN FETCH r.vehicle v JOIN FETCH v.client c WHERE c.user.id = :userId"
            + " AND v.normalizedPlate IN :plates AND " + LATEST)
    List<ItpRecord> findLatestByPlates(@Param("userId") Long userId, @Param("plates") Collection<String> plates);

    // Istoricul unui vehicul, cel mai nou primul
    @Query("SELECT r FROM ItpRecord r JOIN FETCH r.vehicle v JOIN FETCH v.client c WHERE c.user.id = :userId"
            + " AND v.normalizedPlate = :plate ORDER BY r.testDate DESC, r.id DESC")
    List<ItpRecord> findByPlate(@Param("userId") Long userId, @Param("plate") String plate);

    // Cardurile din dashboard: [vehicule, expirate, expira pana la `soon`]
    @Query("SELECT COUNT(r), COALESCE(SUM(CASE WHEN r.nextItpDate < :today THEN 1 ELSE 0 END), 0),"
            + " COALESCE(SUM(CASE WHEN r.nextItpDate >= :today AND r.nextItpDate <= :soon THEN 1 ELSE 0 END), 0)"
            + " FROM ItpRecord r JOIN r.vehicle v JOIN v.client c WHERE c.user.id = :userId AND " + LATEST)
    List<Object[]> latestSummary(@Param("userId") Long userId, @Param("today") LocalDate today, @Param("soon") LocalDate soon);

    // Admin, pe statie: [id manager, ITP-uri, ITP-uri din luna, incasari din luna]
    @Query("SELECT c.user.id, COUNT(r), COALESCE(SUM(CASE WHEN r.testDate >= :monthStart THEN 1 ELSE 0 END), 0),"
            + " COALESCE(SUM(CASE WHEN r.testDate >= :monthStart THEN COALESCE(r.price, 0) ELSE 0 END), 0)"
            + " FROM ItpRecord r JOIN r.vehicle v JOIN v.client c WHERE c.user IS NOT NULL GROUP BY c.user.id")
    List<Object[]> stationTotals(@Param("monthStart") LocalDate monthStart);

    // Admin, pe statie: [id manager, expirate, expira pana la `soon`] (doar ultimul ITP al fiecarui vehicul)
    @Query("SELECT c.user.id, COALESCE(SUM(CASE WHEN r.nextItpDate < :today THEN 1 ELSE 0 END), 0),"
            + " COALESCE(SUM(CASE WHEN r.nextItpDate >= :today AND r.nextItpDate <= :soon THEN 1 ELSE 0 END), 0)"
            + " FROM ItpRecord r JOIN r.vehicle v JOIN v.client c WHERE c.user IS NOT NULL AND " + LATEST
            + " GROUP BY c.user.id")
    List<Object[]> stationExpiry(@Param("today") LocalDate today, @Param("soon") LocalDate soon);

    // Rapoarte si fluturasul flotei: ITP-urile facute intr-un interval
    @Query("SELECT r FROM ItpRecord r JOIN FETCH r.vehicle v JOIN FETCH v.client c WHERE c.user.id = :userId"
            + " AND r.testDate BETWEEN :from AND :to")
    List<ItpRecord> findByUserIdAndTestDateBetween(@Param("userId") Long userId, @Param("from") LocalDate from,
                                                   @Param("to") LocalDate to);

    // Toate statiile (admin); clientii vechi fara manager nu apartin niciunei statii
    @Query("SELECT r FROM ItpRecord r JOIN FETCH r.vehicle v JOIN FETCH v.client c WHERE c.user IS NOT NULL"
            + " AND r.testDate BETWEEN :from AND :to")
    List<ItpRecord> findAllStationsTestDateBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    // Anii pentru selectorul din rapoarte
    @Query("SELECT DISTINCT EXTRACT(YEAR FROM r.testDate) FROM ItpRecord r JOIN r.vehicle v JOIN v.client c"
            + " WHERE c.user IS NOT NULL AND (:userId IS NULL OR c.user.id = :userId)")
    List<Integer> distinctYears(@Param("userId") Long userId);

    // ITP-urile unor vehicule (fisa clientului), cel mai nou primul
    @Query("SELECT r FROM ItpRecord r WHERE r.vehicle.id IN :vehicleIds ORDER BY r.testDate DESC, r.id DESC")
    List<ItpRecord> findByVehicleIds(@Param("vehicleIds") Collection<Long> vehicleIds);

    List<ItpRecord> findByVehicleId(Long vehicleId);

    long countByVehicleId(Long vehicleId);

    // Pentru import: acelasi vehicul si aceeasi data ITP = aceeasi inregistrare (se suprascrie)
    Optional<ItpRecord> findFirstByVehicleIdAndTestDate(Long vehicleId, LocalDate testDate);

    @Query("SELECT r FROM ItpRecord r JOIN r.vehicle v JOIN v.client c WHERE r.id = :id AND c.user.id = :userId")
    Optional<ItpRecord> findByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);
}
