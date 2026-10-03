package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.DashboardDTO;
import org.example.easyitp.dto.FleetDTOs.FleetAccountRequest;
import org.example.easyitp.dto.FleetDTOs.FleetDTO;
import org.example.easyitp.dto.FleetDTOs.FleetOverviewDTO;
import org.example.easyitp.dto.FleetDTOs.FleetStatementDTO;
import org.example.easyitp.dto.FleetDTOs.FleetSummaryDTO;
import org.example.easyitp.dto.FleetDTOs.FleetVehicleDTO;
import org.example.easyitp.dto.FleetDTOs.StatementRowDTO;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Fleet;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.FleetRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

// Flotele (clientii B2B) unei statii: masinile alocate pe numar, scadentele ITP si centralizatorul lunar
@Service
@RequiredArgsConstructor
public class FleetService {

    static final int EXPIRING_DAYS = 30;
    private static final int MAX_PLATES = 2000;
    private static final int MIN_PASSWORD_LENGTH = 6;

    private final FleetRepository fleetRepository;
    private final AppUserRepository appUserRepository;
    private final ItpService itpService;
    private final PasswordEncoder passwordEncoder;

    // ---------- managerul statiei ----------

    @Transactional(readOnly = true)
    public List<FleetSummaryDTO> list(AppUser station) {
        List<DashboardDTO> latest = latestPerVehicle(station);
        LocalDate today = LocalDate.now();
        return fleetRepository.findByStationIdOrderByNameAsc(station.getId()).stream().map(f -> {
            List<FleetVehicleDTO> vehicles = vehicles(f, latest);
            long expired = vehicles.stream().filter(v -> v.nextItpDate() != null && v.nextItpDate().isBefore(today)).count();
            long expiring = vehicles.stream().filter(v -> v.daysLeft() != null && v.daysLeft() >= 0 && v.daysLeft() <= EXPIRING_DAYS).count();
            return new FleetSummaryDTO(f.getId(), f.getName(), f.getCui(), f.getContactName(), f.getContactPhone(),
                    f.getPlates().size(), expired, expiring, accountEmail(f));
        }).toList();
    }

    @Transactional(readOnly = true)
    public FleetDTO get(AppUser station, Long id) {
        return toDto(find(station, id));
    }

    @Transactional
    public FleetDTO create(AppUser station, FleetDTO dto) {
        Fleet fleet = Fleet.builder().station(station).build();
        apply(fleet, dto);
        return toDto(fleetRepository.save(fleet));
    }

    @Transactional
    public FleetDTO update(AppUser station, Long id, FleetDTO dto) {
        Fleet fleet = find(station, id);
        apply(fleet, dto);
        return toDto(fleetRepository.save(fleet));
    }

    // Stergerea firmei sterge si contul ei; ITP-urile masinilor raman la statie
    @Transactional
    public void delete(AppUser station, Long id) {
        Fleet fleet = find(station, id);
        appUserRepository.deleteAll(appUserRepository.findByFleetId(fleet.getId()));
        fleetRepository.delete(fleet);
    }

    // Creeaza contul firmei sau ii schimba emailul/parola (o firma are un singur cont)
    @Transactional
    public FleetDTO saveAccount(AppUser station, Long id, FleetAccountRequest request) {
        Fleet fleet = find(station, id);
        String email = request.email() == null ? "" : request.email().trim().toLowerCase(Locale.ROOT);
        if (!email.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) throw badRequest("Email invalid");

        AppUser account = appUserRepository.findByFleetId(fleet.getId()).stream().findFirst().orElse(null);
        boolean emailTaken = appUserRepository.findByEmail(email)
                .filter(u -> account == null || !Objects.equals(u.getId(), account.getId()))
                .isPresent();
        if (emailTaken) throw new ResponseStatusException(HttpStatus.CONFLICT, "Emailul este deja folosit de alt cont");

        String password = request.password() == null ? "" : request.password();
        if (account == null || !password.isEmpty()) {
            if (password.length() < MIN_PASSWORD_LENGTH) {
                throw badRequest("Parola trebuie sa aiba minim " + MIN_PASSWORD_LENGTH + " caractere");
            }
        }
        AppUser user = account != null ? account : AppUser.builder().role(Role.FLEET).fleetId(fleet.getId()).build();
        user.setEmail(email);
        if (!password.isEmpty()) user.setPassword(passwordEncoder.encode(password));
        user.setActive(true);
        appUserRepository.save(user);
        return toDto(fleet);
    }

    @Transactional
    public FleetDTO deleteAccount(AppUser station, Long id) {
        Fleet fleet = find(station, id);
        appUserRepository.deleteAll(appUserRepository.findByFleetId(fleet.getId()));
        return toDto(fleet);
    }

    @Transactional(readOnly = true)
    public FleetOverviewDTO overview(AppUser station, Long id) {
        return overview(find(station, id));
    }

    @Transactional(readOnly = true)
    public FleetStatementDTO statement(AppUser station, Long id, YearMonth month) {
        return statement(find(station, id), month);
    }

    // ---------- portalul firmei ----------

    @Transactional(readOnly = true)
    public FleetOverviewDTO overviewFor(AppUser fleetUser) {
        return overview(fleetOf(fleetUser));
    }

    @Transactional(readOnly = true)
    public FleetStatementDTO statementFor(AppUser fleetUser, YearMonth month) {
        return statement(fleetOf(fleetUser), month);
    }

    private Fleet fleetOf(AppUser fleetUser) {
        if (fleetUser.getRole() != Role.FLEET || fleetUser.getFleetId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cont fara flota");
        }
        return fleetRepository.findById(fleetUser.getFleetId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Flota nu mai exista"));
    }

    // ---------- calcule ----------

    private FleetOverviewDTO overview(Fleet fleet) {
        AppUser station = fleet.getStation();
        String slug = Boolean.TRUE.equals(station.getBookingEnabled()) ? station.getBookingSlug() : null;
        return new FleetOverviewDTO(fleet.getName(), station.getStationName(), station.getPhone(), station.getAddress(),
                slug, vehicles(fleet, latestPerVehicle(station)));
    }

    // Masinile flotei, cele cu ITP-ul expirat sau cel mai aproape de expirare primele
    private static List<FleetVehicleDTO> vehicles(Fleet fleet, List<DashboardDTO> latestPerVehicle) {
        Map<String, DashboardDTO> byPlate = latestPerVehicle.stream()
                .collect(Collectors.toMap(d -> PlateUtils.normalize(d.getNumarInmatriculare()), d -> d, (a, b) -> a));
        LocalDate today = LocalDate.now();
        return fleet.getPlates().stream()
                .map(plate -> {
                    DashboardDTO d = byPlate.get(PlateUtils.normalize(plate));
                    if (d == null) return new FleetVehicleDTO(plate, null, null, null, null, null, null);
                    // numarul asa cum e scris in fisa ITP ("CJ 13 FAN"), nu cum l-a tastat managerul ("cj13fan")
                    return new FleetVehicleDTO(d.getNumarInmatriculare(), d.getMarca(), d.getModel(), d.getDataItp(), d.getDataUrmatorItp(),
                            ChronoUnit.DAYS.between(today, d.getDataUrmatorItp()), d.getStatus());
                })
                .sorted(Comparator.comparing(FleetVehicleDTO::nextItpDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    private FleetStatementDTO statement(Fleet fleet, YearMonth month) {
        Set<String> plates = fleet.getPlates().stream().map(PlateUtils::normalize).collect(Collectors.toSet());
        List<StatementRowDTO> rows = itpService.getDashboard(fleet.getStation().getId()).stream()
                .filter(d -> d.getDataItp() != null && YearMonth.from(d.getDataItp()).equals(month))
                .filter(d -> plates.contains(PlateUtils.normalize(d.getNumarInmatriculare())))
                .sorted(Comparator.comparing(DashboardDTO::getDataItp).thenComparing(DashboardDTO::getNumarInmatriculare))
                .map(d -> new StatementRowDTO(d.getDataItp(), d.getNumarInmatriculare(), d.getMarca(), d.getModel(),
                        d.getStatus(), d.getValabilitateLuni(), d.getPrice()))
                .toList();
        double total = rows.stream().mapToDouble(r -> r.price() != null ? r.price() : 0).sum();
        return new FleetStatementDTO(fleet.getName(), fleet.getCui(), fleet.getStation().getStationName(),
                month.toString(), rows, Math.round(total * 100) / 100.0);
    }

    // Doar ultimul ITP al fiecarui vehicul conteaza pentru scadenta
    private List<DashboardDTO> latestPerVehicle(AppUser station) {
        return itpService.getDashboard(station.getId()).stream().filter(DashboardDTO::isUltimul).toList();
    }

    // ---------- ajutatoare ----------

    private void apply(Fleet fleet, FleetDTO dto) {
        String name = trimToNull(dto.name());
        if (name == null || name.length() > 120) throw badRequest("Introduceti numele firmei");
        fleet.setName(name);
        fleet.setCui(trimToNull(dto.cui()));
        fleet.setContactName(trimToNull(dto.contactName()));
        fleet.setContactPhone(trimToNull(dto.contactPhone()));
        fleet.getPlates().clear();
        fleet.getPlates().addAll(cleanPlates(dto.plates()));
    }

    // Numere unice (dupa forma normalizata), scrise cu majuscule, in ordinea primita
    static List<String> cleanPlates(List<String> raw) {
        if (raw == null) return List.of();
        Map<String, String> unique = new LinkedHashMap<>();
        for (String plate : raw) {
            if (plate == null) continue;
            String display = plate.trim().toUpperCase(Locale.ROOT).replaceAll("\\s+", " ");
            String key = PlateUtils.normalize(display);
            if (key.length() < 4) continue;
            if (key.length() > 12) throw badRequest("Numar de inmatriculare invalid: " + display);
            unique.putIfAbsent(key, display);
        }
        if (unique.size() > MAX_PLATES) throw badRequest("Maxim " + MAX_PLATES + " de masini pe firma");
        return new ArrayList<>(unique.values());
    }

    private Fleet find(AppUser station, Long id) {
        return fleetRepository.findByIdAndStationId(id, station.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Firma inexistenta"));
    }

    private FleetDTO toDto(Fleet f) {
        return new FleetDTO(f.getId(), f.getName(), f.getCui(), f.getContactName(), f.getContactPhone(),
                List.copyOf(f.getPlates()), accountEmail(f));
    }

    private String accountEmail(Fleet f) {
        return appUserRepository.findByFleetId(f.getId()).stream().findFirst().map(AppUser::getEmail).orElse(null);
    }

    private static String trimToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
