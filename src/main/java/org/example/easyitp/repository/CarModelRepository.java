package org.example.easyitp.repository;

import org.example.easyitp.entity.CarModel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CarModelRepository extends JpaRepository<CarModel, Long> {
    List<CarModel> findAllByMakeIdOrderByNameAsc(Long makeId);
    Optional<CarModel> findByNameIgnoreCaseAndMakeId(String name, Long makeId);
}
