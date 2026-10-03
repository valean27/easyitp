package org.example.easyitp.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class ImportResultDTO {
    private int imported;
    // inregistrari existente suprascrise (acelasi numar + aceeasi data ITP)
    private int updated;
    private int skipped;
    private List<String> errors;
}
