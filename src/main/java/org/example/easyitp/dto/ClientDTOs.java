package org.example.easyitp.dto;

import org.example.easyitp.entity.ItpStatus;
import org.example.easyitp.entity.ReminderConsent;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

// Pagina "Clienti": un client cu masinile lui si istoricul ITP pe fiecare masina
public final class ClientDTOs {

    private ClientDTOs() {
    }

    // nextItpDate = cea mai apropiata scadenta dintre masinile clientului (ultimul ITP al fiecarei masini)
    public record ClientSummaryDTO(Long id, String name, String phone, int vehicleCount, List<String> plates,
                                   LocalDate nextItpDate, Long daysLeft) {
    }

    public record ClientPageDTO(List<ClientSummaryDTO> items, long total, int page, int size) {
    }

    public record VehicleItpDTO(Long id, LocalDate testDate, Integer validityMonths, LocalDate nextItpDate,
                                ItpStatus status, Integer mileage, Double price, String inspector) {
    }

    public record VehicleDTO(Long id, String licensePlate, String brand, String model, Integer year, String vin,
                             List<VehicleItpDTO> itps) {
    }

    // consent: acordul pentru remindere (null = necunoscut), cu data si sursa ultimei schimbari
    public record ClientDetailDTO(Long id, String name, String phone, ReminderConsent consent, LocalDateTime consentAt,
                                  String consentSource, List<VehicleDTO> vehicles) {
    }

    public record ConsentRequest(ReminderConsent consent) {
    }

    public record ClientUpdateRequest(String name, String phone) {
    }

    public record VehicleUpdateRequest(String licensePlate, String brand, String model, Integer year, String vin) {
    }

    public record TargetClientRequest(Long clientId) {
    }

    public record ClientBriefDTO(Long id, String name, String phone, long vehicleCount) {
    }

    // Clienti care par sa fie aceeasi persoana (acelasi telefon sau acelasi nume)
    public record DuplicateGroupDTO(String reason, List<ClientBriefDTO> clients) {
    }
}
