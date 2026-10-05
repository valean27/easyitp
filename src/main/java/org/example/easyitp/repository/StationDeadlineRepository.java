package org.example.easyitp.repository;

import org.example.easyitp.entity.StationDeadline;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface StationDeadlineRepository extends JpaRepository<StationDeadline, Long> {

    List<StationDeadline> findByUserIdOrderByDueDateAsc(Long userId);

    Optional<StationDeadline> findByIdAndUserId(Long id, Long userId);

    @Transactional
    void deleteByUserId(Long userId);
}
