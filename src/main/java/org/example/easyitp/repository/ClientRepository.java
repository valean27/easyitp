package org.example.easyitp.repository;

import org.example.easyitp.entity.Client;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClientRepository extends JpaRepository<Client, Long> {

    boolean existsByUserId(Long userId);

    Optional<Client> findByOptOutToken(String optOutToken);

    Optional<Client> findByIdAndUserId(Long id, Long userId);

    // Clientii statiei cu acelasi telefon (ultimele 9 cifre)
    List<Client> findByUserIdAndPhoneKey(Long userId, String phoneKey);

    // Toti clientii statiei (doar pentru cautarea dublurilor)
    List<Client> findByUserIdOrderByIdAsc(Long userId);

    // Lista "Clienti": cautare dupa nume, telefon sau numarul unei masini
    @Query(value = """
            SELECT c FROM Client c WHERE c.user.id = :userId AND (:like = ''
               OR LOWER(c.name) LIKE :like ESCAPE '!'
               OR (:digits <> '' AND c.phoneKey LIKE :digits)
               OR (:plateLike <> '' AND EXISTS (SELECT 1 FROM Vehicle v WHERE v.client = c AND v.normalizedPlate LIKE :plateLike ESCAPE '!')))
            ORDER BY LOWER(c.name), c.id
            """)
    Page<Client> search(@Param("userId") Long userId, @Param("like") String like, @Param("digits") String digits,
                        @Param("plateLike") String plateLike, Pageable pageable);
}
