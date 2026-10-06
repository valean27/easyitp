package org.example.easyitp.repository;

import org.example.easyitp.entity.Withdrawal;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface WithdrawalRepository extends JpaRepository<Withdrawal, Long> {

    List<Withdrawal> findAllByOrderByCreatedAtDesc(Pageable page);

    @Transactional
    void deleteByUserId(Long userId);
}
