package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

// Ultima zi in care a rulat o sarcina programata (ex. "daily"), ca sa ruleze o singura data pe zi
@Entity
@Table(name = "job_runs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobRun {

    @Id
    @Column(length = 40)
    private String name;

    private LocalDate lastDate;
}
