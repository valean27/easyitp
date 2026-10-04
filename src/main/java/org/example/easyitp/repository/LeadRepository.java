package org.example.easyitp.repository;

import org.example.easyitp.entity.Lead;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LeadRepository extends JpaRepository<Lead, Long> {

    List<Lead> findAllByOrderByCreatedAtDesc(Pageable pageable);

    long countByHandledFalse();
}
