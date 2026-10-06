package org.example.easyitp.repository;

import org.example.easyitp.entity.JobRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.Optional;

public interface JobRunRepository extends JpaRepository<JobRun, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select j from JobRun j where j.name = :name")
    Optional<JobRun> lockByName(@Param("name") String name);
}
