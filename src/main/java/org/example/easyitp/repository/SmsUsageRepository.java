package org.example.easyitp.repository;

import org.example.easyitp.entity.SmsUsage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SmsUsageRepository extends JpaRepository<SmsUsage, Long> {

    Optional<SmsUsage> findByUserIdAndMonth(Long userId, String month);

    List<SmsUsage> findByMonth(String month);
}
