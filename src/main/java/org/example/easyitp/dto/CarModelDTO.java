package org.example.easyitp.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class CarModelDTO {
    private Long id;
    private String name;
    private Long makeId;
}
