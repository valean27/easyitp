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
    private String reminderTemplate;
    // Pentru link-ul de programare online din mesaje si din "Contul meu"
    private String bookingSlug;
    private boolean bookingEnabled;
    private boolean digestEnabled;
}
