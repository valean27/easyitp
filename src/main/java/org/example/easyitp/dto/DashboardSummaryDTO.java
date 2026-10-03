package org.example.easyitp.dto;

// Cardurile din dashboard, socotite pe ultimul ITP al fiecarui vehicul
public record DashboardSummaryDTO(long vehicles, long valid, long expiringSoon, long expired) {
}
