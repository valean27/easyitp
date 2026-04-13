package org.example.easyitp.repository;

import org.example.easyitp.entity.Appointment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, Long> {

    List<Appointment> findByUserIdAndAppointmentDateBetweenOrderByAppointmentDateAsc(
            Long userId, LocalDateTime start, LocalDateTime end);

    Optional<Appointment> findByIdAndUserId(Long id, Long userId);
}
