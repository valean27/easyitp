package org.example.easyitp.dto;

import org.example.easyitp.entity.ItpStatus;

import java.time.LocalDate;
import java.util.List;

// Datele portalului pentru flote (B2B)
public final class FleetDTOs {

    private FleetDTOs() {
    }

    // Firma, asa cum o editeaza managerul; "accountEmail" = contul cu care se logheaza firma (null daca nu are)
    public record FleetDTO(Long id, String name, String cui, String contactName, String contactPhone,
                           List<String> plates, String accountEmail) {
    }

    // Randul din lista de firme a managerului
    public record FleetSummaryDTO(Long id, String name, String cui, String contactName, String contactPhone,
                                  int vehicleCount, long expiredCount, long expiringCount, String accountEmail) {
    }

    // Contul firmei: email + parola noua (la creare sau resetare)
    public record FleetAccountRequest(String email, String password) {
    }

    // O masina a flotei; campurile ITP sunt null daca masina n-a facut inca ITP la statie
    public record FleetVehicleDTO(String plate, String brand, String model, LocalDate lastItpDate,
                                  LocalDate nextItpDate, Long daysLeft, ItpStatus status) {
    }

    // Ce vede firma: masinile ei si datele de contact ale statiei
    public record FleetOverviewDTO(String fleetName, String stationName, String stationPhone, String stationAddress,
                                   String bookingSlug, List<FleetVehicleDTO> vehicles) {
    }

    public record StatementRowDTO(LocalDate date, String plate, String brand, String model, ItpStatus status,
                                  Integer validityMonths, Double price) {
    }

    // Centralizatorul lunar: toate ITP-urile flotei dintr-o luna, cu total
    public record FleetStatementDTO(String fleetName, String cui, String stationName, String month,
                                    List<StatementRowDTO> rows, double total) {
    }
}
