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

    Optional<Vehicle> findByVinAndClientUserId(String vin, Long userId);

    // Comparam numerele fara spatii/cratime si fara diferente de majuscule (coloana normalized_plate, indexata)
    @Query("""
            SELECT v FROM Vehicle v JOIN FETCH v.client c
            WHERE c.user.id = :userId AND v.normalizedPlate = :plate
            ORDER BY v.id DESC
            """)
    List<Vehicle> findByNormalizedPlate(@Param("plate") String normalizedPlate, @Param("userId") Long userId);
}
