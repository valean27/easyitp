package org.example.easyitp.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalTime;
import java.util.List;

// Ce vede clientul pe pagina publica: doar datele de contact si programul statiei
@Data
@AllArgsConstructor
public class PublicStationDTO {
    private String name;
    private String address;
    private String phone;
    private LocalTime open;
    private LocalTime close;
    private List<Integer> days;
    private int maxDaysAhead;
}
