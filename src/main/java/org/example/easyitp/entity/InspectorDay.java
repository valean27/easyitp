package org.example.easyitp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalTime;

// O zi din programul saptamanal al inspectorului: 1 = luni ... 7 = duminica; line null = linia lui obisnuita
@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InspectorDay {

    @Column(nullable = false)
    private Integer weekday;

    @Column(name = "line_no")
    private Integer line;

    @Column(name = "start_time")
    private LocalTime start;

    @Column(name = "end_time")
    private LocalTime end;
}
