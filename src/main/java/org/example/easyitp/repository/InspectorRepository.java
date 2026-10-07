package org.example.easyitp.repository;

import org.example.easyitp.entity.Inspector;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface InspectorRepository extends JpaRepository<Inspector, Long> {

    List<Inspector> findByUserIdOrderByPositionAscIdAsc(Long userId);

    Optional<Inspector> findByIdAndUserId(Long id, Long userId);

    // La redenumire: ITP-urile statiei facute de inspector primesc noul nume
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            UPDATE itp_records SET inspector = :newName
            WHERE inspector = :oldName
              AND vehicle_id IN (SELECT v.id FROM vehicles v JOIN clients c ON v.client_id = c.id WHERE c.user_id = :userId)
            """, nativeQuery = true)
    int renameOnItps(@Param("userId") Long userId, @Param("oldName") String oldName, @Param("newName") String newName);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE Appointment a SET a.inspectorId = null WHERE a.inspectorId = :id")
    void unlinkAppointments(@Param("id") Long id);
}
