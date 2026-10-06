package org.example.easyitp.repository;

import org.example.easyitp.entity.Payment;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    Optional<Payment> findByOrderId(String orderId);

    // Confirmarea (IPN si intoarcerea din pagina de plata pot sosi deodata): o singura aplicare a platii
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Payment p where p.orderId = :orderId")
    Optional<Payment> lockByOrderId(@Param("orderId") String orderId);

    List<Payment> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable page);

    List<Payment> findAllByOrderByCreatedAtDesc(Pageable page);

    @org.springframework.transaction.annotation.Transactional
    void deleteByUserId(Long userId);
}
