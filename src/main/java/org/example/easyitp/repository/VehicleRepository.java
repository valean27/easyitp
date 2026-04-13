package org.example.easyitp.repository;

import org.example.easyitp.entity.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface VehicleRepository extends JpaRepository<Vehicle, Long> {

    Optional<Vehicle> findByVinAndClientUserId(String vin, Long userId);

    Optional<Vehicle> findByLicensePlateAndClientUserId(String licensePlate, Long userId);
}
