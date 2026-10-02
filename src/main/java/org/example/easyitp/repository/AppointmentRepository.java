package org.example.easyitp.repository;

import org.example.easyitp.entity.Appointment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, Long> {

    List<Appointment> findByUserIdAndAppointmentDateBetweenOrderByAppointmentDateAsc(
            Long userId, LocalDateTime start, LocalDateTime end);

    Optional<Appointment> findByIdAndUserId(Long id, Long userId);

    boolean existsByUserId(Long userId);

    // [userId, numar programari in interval]
    @Query("SELECT a.user.id, COUNT(a) FROM Appointment a WHERE a.appointmentDate >= :start AND a.appointmentDate < :end GROUP BY a.user.id")
    List<Object[]> countByUserBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
