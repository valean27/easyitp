package org.example.easyitp.repository;

import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    Optional<AppUser> findByEmail(String email);

    Optional<AppUser> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    List<AppUser> findByRoleOrderByIdAsc(Role role);

    Optional<AppUser> findByBookingSlug(String bookingSlug);

    boolean existsByBookingSlug(String bookingSlug);

    List<AppUser> findByFleetId(Long fleetId);

    List<AppUser> findByFleetIdIn(java.util.Collection<Long> fleetIds);

    // Rezerva ziua pentru rezumatul zilnic: un singur apel reuseste (1), chiar daca doua rulari pornesc deodata
    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("update AppUser u set u.lastDigestDate = :today "
            + "where u.id = :id and (u.lastDigestDate is null or u.lastDigestDate < :today)")
    int claimDigest(@Param("id") Long id, @Param("today") LocalDate today);

    // Trimiterea a esuat: ziua se elibereaza, ca rularea urmatoare sa reincerce
    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("update AppUser u set u.lastDigestDate = :previous where u.id = :id and u.lastDigestDate = :today")
    int releaseDigest(@Param("id") Long id, @Param("today") LocalDate today, @Param("previous") LocalDate previous);
}
