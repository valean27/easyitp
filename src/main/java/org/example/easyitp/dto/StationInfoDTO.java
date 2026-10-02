package org.example.easyitp.dto;

import lombok.Data;

@Data
public class StationInfoDTO {
    private String stationName;
    private String address;
    private String phone;
    // Folosit doar de manager in "Contul meu"; adminul nu il modifica
    private String reminderTemplate;
}
