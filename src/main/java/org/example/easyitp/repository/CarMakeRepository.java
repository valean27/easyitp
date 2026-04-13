package org.example.easyitp.repository;

import org.example.easyitp.entity.CarMake;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CarMakeRepository extends JpaRepository<CarMake, Long> {
    Optional<CarMake> findByNameIgnoreCase(String name);
    List<CarMake> findAllByOrderByNameAsc();
}
