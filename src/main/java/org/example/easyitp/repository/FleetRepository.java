package org.example.easyitp.repository;

import org.example.easyitp.entity.Fleet;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FleetRepository extends JpaRepository<Fleet, Long> {
    List<Fleet> findByStationIdOrderByNameAsc(Long stationId);

    Optional<Fleet> findByIdAndStationId(Long id, Long stationId);

    boolean existsByStationId(Long stationId);
}
