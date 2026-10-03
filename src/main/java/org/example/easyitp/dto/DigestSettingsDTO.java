package org.example.easyitp.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.example.easyitp.entity.DigestChannel;

// Setarile rezumatului zilnic; cheia CallMeBot nu se trimite niciodata inapoi catre browser
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DigestSettingsDTO {
    private boolean enabled;
    private DigestChannel channel;
    private String whatsappPhone;
    // Doar la salvare; gol = se pastreaza cheia existenta
    private String callmebotApiKey;
    private boolean hasApiKey;
}
