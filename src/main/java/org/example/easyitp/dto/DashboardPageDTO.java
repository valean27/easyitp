package org.example.easyitp.dto;

import java.util.List;

// O pagina din tabelul dashboard-ului; total = cate inregistrari se potrivesc filtrului
public record DashboardPageDTO(List<DashboardDTO> items, long total, int page, int size) {
}
