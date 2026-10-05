package org.example.easyitp.repository;

import org.example.easyitp.entity.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VehicleRepository extends JpaRepository<Vehicle, Long> {

    @Query("SELECT v FROM Vehicle v JOIN FETCH v.client c WHERE v.id = :id AND c.user.id = :userId")
    Optional<Vehicle> findByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);

    List<Vehicle> findByClientIdInOrderByIdAsc(java.util.Collection<Long> clientIds);

    long countByClientId(Long clientId);

    // [id client, numar de masini] pentru clientii statiei
    @Query("SELECT v.client.id, COUNT(v) FROM Vehicle v WHERE v.client.user.id = :userId GROUP BY v.client.id")
    List<Object[]> countByClientForUser(@Param("userId") Long userId);

    // Comparam numerele fara spatii/cratime si fara diferente de majuscule (coloana normalized_plate, indexata)
    @Query("""
            SELECT v FROM Vehicle v JOIN FETCH v.client c
            WHERE c.user.id = :userId AND v.normalizedPlate = :plate
            ORDER BY v.id DESC
            """)
    List<Vehicle> findByNormalizedPlate(@Param("plate") String normalizedPlate, @Param("userId") Long userId);

    // Masinile statiei cu o alta scadenta (RCA, rovinieta, tahograf) intre doua date, cu clientul si toate scadentele
    @Query("""
            SELECT DISTINCT v FROM Vehicle v JOIN FETCH v.client c LEFT JOIN FETCH v.deadlines
            WHERE c.user.id = :userId AND EXISTS (
                SELECT 1 FROM Vehicle v2 JOIN v2.deadlines d
                WHERE v2.id = v.id AND d.dueDate BETWEEN :from AND :to)
            """)
    List<Vehicle> findWithDeadlinesBetween(@Param("userId") Long userId, @Param("from") java.time.LocalDate from,
                                           @Param("to") java.time.LocalDate to);
}
