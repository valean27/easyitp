package org.example.easyitp.repository;

import org.example.easyitp.entity.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    Optional<Invoice> findByUserIdAndFleetIdAndPeriod(Long userId, Long fleetId, String period);

    Optional<Invoice> findByUserIdAndItpRecordId(Long userId, Long itpRecordId);

    List<Invoice> findByUserIdAndItpRecordIdIn(Long userId, Collection<Long> itpRecordIds);

    @Transactional
    void deleteByUserId(Long userId);
}
