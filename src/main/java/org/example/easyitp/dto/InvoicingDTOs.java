package org.example.easyitp.dto;

import org.example.easyitp.service.OblioClient;

import java.time.LocalDateTime;
import java.util.List;

// Facturarea prin Oblio: setarile statiei (cheia API doar de scris), optiunile din contul Oblio, facturile emise
public final class InvoicingDTOs {

    private InvoicingDTOs() {
    }

    public record SettingsDTO(String email, String secret, boolean hasSecret, String cif, String series, String vatName,
                              Double vatPercent, boolean vatIncluded, boolean einvoice, int dueDays, boolean ready) {
    }

    // Ce se poate alege din contul Oblio: firmele, apoi (pentru firma aleasa) seriile si cotele de TVA
    public record OptionsDTO(List<OblioClient.Company> companies, List<String> series, List<OblioClient.VatRate> vatRates) {
    }

    public record InvoiceDTO(Long id, String seriesName, String number, String link, double total, String clientName,
                             String einvoiceStatus, LocalDateTime createdAt) {
    }
}
