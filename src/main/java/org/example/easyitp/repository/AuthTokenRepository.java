package org.example.easyitp.repository;

import org.example.easyitp.entity.AuthToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.Optional;

public interface AuthTokenRepository extends JpaRepository<AuthToken, Long> {

    // Doua cereri cu acelasi link nu-l pot folosi amandoua
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from AuthToken t where t.tokenHash = :hash")
    Optional<AuthToken> lockByHash(@Param("hash") String hash);

    // Un link nou il anuleaza pe cel vechi (acelasi scop)
    @Transactional
    @Modifying
    @Query("update AuthToken t set t.usedAt = :now where t.userId = :userId and t.purpose = :purpose and t.usedAt is null")
    int invalidate(@Param("userId") Long userId, @Param("purpose") AuthToken.Purpose purpose, @Param("now") LocalDateTime now);

    @Transactional
    void deleteByUserId(Long userId);

    @Transactional
    @Modifying
    @Query("delete from AuthToken t where t.expiresAt < :before")
    int purgeExpired(@Param("before") LocalDateTime before);
}
