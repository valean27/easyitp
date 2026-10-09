package org.example.easyitp.repository;

import org.example.easyitp.entity.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

    List<PushSubscription> findByUserIdIn(Collection<Long> userIds);

    Optional<PushSubscription> findByEndpoint(String endpoint);

    long countByUserId(Long userId);

    @Modifying
    @Query("DELETE FROM PushSubscription s WHERE s.endpoint = :endpoint AND s.userId = :userId")
    int deleteMine(@Param("userId") Long userId, @Param("endpoint") String endpoint);
}
