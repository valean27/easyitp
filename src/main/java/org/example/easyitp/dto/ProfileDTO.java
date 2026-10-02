package org.example.easyitp.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ProfileDTO {
    private String email;
    private String role;
    private String stationName;
    private String address;
    private String phone;
}
