package org.example.easyitp.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class ImportResultDTO {
    private int imported;
    private int skipped;
    private List<String> errors;
}
