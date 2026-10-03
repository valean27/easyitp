package org.example.easyitp.repository;

import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

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
}
