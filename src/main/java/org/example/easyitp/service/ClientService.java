package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.ClientDTOs.ClientBriefDTO;
import org.example.easyitp.dto.ClientDTOs.ClientDetailDTO;
import org.example.easyitp.dto.ClientDTOs.ClientPageDTO;
import org.example.easyitp.dto.ClientDTOs.ClientSummaryDTO;
import org.example.easyitp.dto.ClientDTOs.ClientUpdateRequest;
import org.example.easyitp.dto.ClientDTOs.DuplicateGroupDTO;
import org.example.easyitp.dto.ClientDTOs.VehicleDTO;
import org.example.easyitp.dto.ClientDTOs.VehicleItpDTO;
import org.example.easyitp.dto.ClientDTOs.VehicleUpdateRequest;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.AuditEvent.Action;
import org.example.easyitp.entity.AuditEvent.EntityType;
import org.example.easyitp.entity.Client;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.entity.ItpStatus;
import org.example.easyitp.entity.Vehicle;
import org.example.easyitp.repository.AppointmentRepository;
import org.example.easyitp.repository.ClientRepository;
import org.example.easyitp.repository.ItpRecordRepository;
import org.example.easyitp.repository.VehicleRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

// Clientii statiei si masinile lor: cautare, fisa clientului, editare, mutare, unire dubluri, stergere.
// Tot aici: cui ii apartine o masina la salvarea unui ITP si curatarea clientilor/masinilor ramase fara date.
@Service
@RequiredArgsConstructor
public class ClientService {

    static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_PLATES_IN_LIST = 5;
    private static final int MAX_DUPLICATE_GROUPS = 50;
    private static final int MAX_NAME = 120;

    private final ClientRepository clientRepository;
    private final VehicleRepository vehicleRepository;
    private final ItpRecordRepository itpRecordRepository;
    private final AppointmentRepository appointmentRepository;
    private final AuditService auditService;

    // Rezultatul stergerii unei masini: fisa clientului (null daca a disparut) si intrarea din istoric (pentru "Anuleaza")
    public record VehicleDeletion(ClientDetailDTO client, Long eventId) {
    }

    // ---------- proprietarul la salvarea unui ITP ----------

    // Cui ii apartine masina dupa un ITP introdus cu numele/telefonul din formular:
    //  - acelasi nume ca proprietarul actual -> el (i se completeaza telefonul);
    //  - un client al statiei cu acelasi nume si acelasi telefon -> acela (un om cu mai multe masini);
    //  - proprietarul actual nu are alte masini -> il redenumim (corectura sau masina vanduta);
    //  - altfel un client nou.
    // Apelantul muta masina la clientul intors si apeleaza deleteClientIfEmpty pe cel vechi.
    public Client resolveOwner(AppUser user, Vehicle vehicle, String name, String phone) {
        String cleanName = name.trim().replaceAll("\\s+", " ");
        String cleanPhone = trimToNull(phone);
        Client current = vehicle != null ? vehicle.getClient() : null;

        if (current != null && ClientKeys.sameName(current.getName(), cleanName)) {
            current.setName(cleanName);
            if (cleanPhone != null) current.setPhone(cleanPhone);
            return clientRepository.save(current);
        }
        String phoneKey = ClientKeys.phoneKey(cleanPhone);
        if (phoneKey != null) {
            Client match = clientRepository.findByUserIdAndPhoneKey(user.getId(), phoneKey).stream()
                    .filter(c -> ClientKeys.sameName(c.getName(), cleanName))
                    .findFirst().orElse(null);
            if (match != null) return match;
        }
        if (current != null && otherVehicles(current, vehicle) == 0) {
            current.setName(cleanName);
            current.setPhone(cleanPhone);
            return clientRepository.save(current);
        }
        return clientRepository.save(Client.builder().name(cleanName).phone(cleanPhone).user(user).build());
    }

    private long otherVehicles(Client client, Vehicle vehicle) {
        long count = vehicleRepository.countByClientId(client.getId());
        boolean counted = vehicle != null && vehicle.getId() != null && vehicle.getClient() == client;
        return counted ? count - 1 : count;
    }

    // ---------- curatare ----------

    public void deleteClientIfEmpty(Client client) {
        if (client != null && client.getId() != null && vehicleRepository.countByClientId(client.getId()) == 0) {
            clientRepository.delete(client);
        }
    }

    public void deleteVehicleIfEmpty(Vehicle vehicle) {
        if (vehicle == null || vehicle.getId() == null || itpRecordRepository.countByVehicleId(vehicle.getId()) > 0) return;
        Client client = vehicle.getClient();
        vehicleRepository.delete(vehicle);
        vehicleRepository.flush();
        deleteClientIfEmpty(client);
    }

    // ITP-urile sterse se dezleaga de programarile din care au fost facute
    public void deleteRecords(Collection<ItpRecord> records) {
        if (records.isEmpty()) return;
        appointmentRepository.findByItpRecordIdIn(records.stream().map(ItpRecord::getId).toList())
                .forEach(a -> a.setItpRecordId(null));
        itpRecordRepository.deleteAll(records);
        itpRecordRepository.flush();
    }

    // Datele unui client (doar masinile si ITP-urile date), pastrate in istoric ca stergerea sa poata fi anulata
    public AuditService.ClientSnap snapshot(Client client, List<Vehicle> vehicles, Collection<ItpRecord> records) {
        Map<Long, List<Long>> appointmentsByRecord = new HashMap<>();
        if (!records.isEmpty()) {
            appointmentRepository.findByItpRecordIdIn(records.stream().map(ItpRecord::getId).toList())
                    .forEach(a -> appointmentsByRecord.computeIfAbsent(a.getItpRecordId(), k -> new ArrayList<>()).add(a.getId()));
        }
        List<AuditService.VehicleSnap> vehicleSnaps = vehicles.stream()
                .map(v -> AuditService.snap(v, records.stream()
                        .filter(r -> r.getVehicle().getId().equals(v.getId()))
                        .map(r -> AuditService.snap(r, appointmentsByRecord.getOrDefault(r.getId(), List.of())))
                        .toList()))
                .toList();
        return new AuditService.ClientSnap(client.getName(), client.getPhone(), vehicleSnaps);
    }

    // ---------- pagina "Clienti" ----------

    @Transactional(readOnly = true)
    public ClientPageDTO list(AppUser user, String query, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        String digits = q.replaceAll("\\D", "");
        String plate = PlateUtils.normalize(q);
        Page<Client> result = clientRepository.search(user.getId(),
                q.isEmpty() ? "" : "%" + escapeLike(q) + "%",
                digits.length() >= 3 ? "%" + digits + "%" : "",
                plate.length() >= 2 ? "%" + escapeLike(plate) + "%" : "",
                PageRequest.of(safePage, safeSize));

        List<Long> ids = result.stream().map(Client::getId).toList();
        Map<Long, List<Vehicle>> vehiclesByClient = ids.isEmpty() ? Map.of()
                : vehicleRepository.findByClientIdInOrderByIdAsc(ids).stream()
                        .collect(Collectors.groupingBy(v -> v.getClient().getId()));
        Map<Long, ItpRecord> latestByVehicle = latestByVehicle(
                vehiclesByClient.values().stream().flatMap(List::stream).map(Vehicle::getId).toList());

        LocalDate today = LocalDate.now();
        List<ClientSummaryDTO> items = result.stream().map(c -> {
            List<Vehicle> vehicles = vehiclesByClient.getOrDefault(c.getId(), List.of());
            LocalDate next = vehicles.stream()
                    .map(v -> latestByVehicle.get(v.getId()))
                    .filter(Objects::nonNull)
                    .map(ItpRecord::getNextItpDate)
                    .min(Comparator.naturalOrder()).orElse(null);
            return new ClientSummaryDTO(c.getId(), c.getName(), c.getPhone(), vehicles.size(),
                    vehicles.stream().limit(MAX_PLATES_IN_LIST).map(Vehicle::getLicensePlate).toList(),
                    next, next == null ? null : ChronoUnit.DAYS.between(today, next));
        }).toList();
        return new ClientPageDTO(items, result.getTotalElements(), safePage, safeSize);
    }

    // Ultimul ITP al fiecarui vehicul (lista vine ordonata cel mai nou primul)
    private Map<Long, ItpRecord> latestByVehicle(List<Long> vehicleIds) {
        Map<Long, ItpRecord> latest = new HashMap<>();
        if (vehicleIds.isEmpty()) return latest;
        itpRecordRepository.findByVehicleIds(vehicleIds).forEach(r -> latest.putIfAbsent(r.getVehicle().getId(), r));
        return latest;
    }

    @Transactional(readOnly = true)
    public ClientDetailDTO get(AppUser user, Long id) {
        return detail(find(user, id));
    }

    private ClientDetailDTO detail(Client client) {
        List<Vehicle> vehicles = vehicleRepository.findByClientIdInOrderByIdAsc(List.of(client.getId()));
        Map<Long, List<ItpRecord>> records = vehicles.isEmpty() ? Map.of()
                : itpRecordRepository.findByVehicleIds(vehicles.stream().map(Vehicle::getId).toList()).stream()
                        .collect(Collectors.groupingBy(r -> r.getVehicle().getId(), LinkedHashMap::new, Collectors.toList()));
        List<VehicleDTO> vehicleDtos = vehicles.stream()
                .map(v -> new VehicleDTO(v.getId(), v.getLicensePlate(), v.getBrand(), v.getModel(), v.getYear(), v.getVin(),
                        records.getOrDefault(v.getId(), List.of()).stream().map(ClientService::itpDto).toList()))
                // masina cu cel mai recent ITP prima
                .sorted(Comparator.comparing((VehicleDTO v) -> v.itps().isEmpty() ? null : v.itps().get(0).testDate(),
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
        return new ClientDetailDTO(client.getId(), client.getName(), client.getPhone(), vehicleDtos);
    }

    private static VehicleItpDTO itpDto(ItpRecord r) {
        return new VehicleItpDTO(r.getId(), r.getTestDate(), r.getValidityMonths(), r.getNextItpDate(),
                r.getStatus() != null ? r.getStatus() : ItpStatus.PASSED, r.getMileage(), r.getPrice(), r.getInspector());
    }

    @Transactional
    public ClientDetailDTO update(AppUser user, Long id, ClientUpdateRequest request) {
        Client client = find(user, id);
        Map<String, String> before = AuditService.clientFields(client);
        client.setName(requireName(request.name()));
        client.setPhone(trimToNull(request.phone()));
        clientRepository.save(client);
        String changes = AuditService.diff(before, AuditService.clientFields(client));
        if (!changes.isEmpty()) {
            auditService.record(user, Action.UPDATE, EntityType.CLIENT, client.getId(), AuditService.clientSummary(client), changes);
        }
        return detail(client);
    }

    @Transactional
    public ClientDetailDTO updateVehicle(AppUser user, Long vehicleId, VehicleUpdateRequest request) {
        Vehicle vehicle = findVehicle(user, vehicleId);
        String plate = trimToNull(request.licensePlate());
        if (plate == null || PlateUtils.normalize(plate).length() < 2) throw badRequest("Introduceți numărul de înmatriculare");
        String brand = trimToNull(request.brand());
        if (brand == null) throw badRequest("Introduceți marca");
        if (request.year() != null && (request.year() < 1900 || request.year() > LocalDate.now().getYear() + 1)) {
            throw badRequest("An de fabricație invalid");
        }
        Vehicle other = vehicleRepository.findByNormalizedPlate(PlateUtils.normalize(plate), user.getId()).stream()
                .filter(v -> !v.getId().equals(vehicle.getId()))
                .findFirst().orElse(null);
        if (other != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Numărul " + plate.toUpperCase(Locale.ROOT) + " există deja la clientul " + other.getClient().getName() + ".");
        }
        Map<String, String> before = AuditService.vehicleFields(vehicle);
        vehicle.setLicensePlate(plate.toUpperCase(Locale.ROOT));
        vehicle.setBrand(brand);
        vehicle.setModel(trimToNull(request.model()));
        vehicle.setYear(request.year());
        vehicle.setVin(trimToNull(request.vin()) == null ? null : request.vin().trim().toUpperCase(Locale.ROOT));
        vehicleRepository.save(vehicle);
        String changes = AuditService.diff(before, AuditService.vehicleFields(vehicle));
        if (!changes.isEmpty()) {
            auditService.record(user, Action.UPDATE, EntityType.VEHICLE, vehicle.getId(), AuditService.vehicleSummary(vehicle), changes);
        }
        return detail(vehicle.getClient());
    }

    // Masina trece la alt client (ex. a fost vanduta); clientul vechi ramas fara masini dispare
    @Transactional
    public ClientDetailDTO moveVehicle(AppUser user, Long vehicleId, Long targetClientId) {
        Vehicle vehicle = findVehicle(user, vehicleId);
        Client target = find(user, targetClientId);
        Client old = vehicle.getClient();
        vehicle.setClient(target);
        vehicleRepository.saveAndFlush(vehicle);
        auditService.record(user, Action.MOVE, EntityType.VEHICLE, vehicle.getId(),
                vehicle.getLicensePlate().toUpperCase(Locale.ROOT) + " · de la " + old.getName() + " la " + target.getName(), null);
        if (!old.getId().equals(target.getId())) deleteClientIfEmpty(old);
        return detail(target);
    }

    // Doi clienti sunt de fapt aceeasi persoana: masinile trec la `target`, `source` dispare
    @Transactional
    public ClientDetailDTO merge(AppUser user, Long sourceId, Long targetId) {
        if (Objects.equals(sourceId, targetId)) throw badRequest("Alegeți un alt client");
        Client source = find(user, sourceId);
        Client target = find(user, targetId);
        List<Vehicle> moved = vehicleRepository.findByClientIdInOrderByIdAsc(List.of(source.getId()));
        for (Vehicle v : moved) {
            v.setClient(target);
            vehicleRepository.save(v);
        }
        auditService.record(user, Action.MERGE, EntityType.CLIENT, target.getId(),
                AuditService.clientSummary(source) + " unit cu " + AuditService.clientSummary(target),
                moved.isEmpty() ? null : "Mașini mutate: " + moved.stream().map(v -> v.getLicensePlate().toUpperCase(Locale.ROOT))
                        .collect(Collectors.joining(", ")));
        if (target.getPhone() == null && source.getPhone() != null) target.setPhone(source.getPhone());
        clientRepository.save(target);
        vehicleRepository.flush();
        clientRepository.delete(source);
        return detail(target);
    }

    // Sterge clientul cu toate masinile si ITP-urile lor; intoarce intrarea din istoric (pentru "Anuleaza")
    @Transactional
    public Long delete(AppUser user, Long id) {
        Client client = find(user, id);
        List<Vehicle> vehicles = vehicleRepository.findByClientIdInOrderByIdAsc(List.of(client.getId()));
        List<ItpRecord> records = vehicles.isEmpty() ? List.of()
                : itpRecordRepository.findByVehicleIds(vehicles.stream().map(Vehicle::getId).toList());
        Long eventId = auditService.recordDeletion(user, EntityType.CLIENT, client.getId(),
                AuditService.clientSummary(client) + " · " + vehicles.size() + " mașini, " + records.size() + " ITP-uri",
                snapshot(client, vehicles, records));
        if (!vehicles.isEmpty()) {
            deleteRecords(records);
            vehicleRepository.deleteAll(vehicles);
            vehicleRepository.flush();
        }
        clientRepository.delete(client);
        return eventId;
    }

    // Sterge masina cu ITP-urile ei; fisa clientului e null daca a ramas fara masini si a disparut
    @Transactional
    public VehicleDeletion deleteVehicle(AppUser user, Long vehicleId) {
        Vehicle vehicle = findVehicle(user, vehicleId);
        Client client = vehicle.getClient();
        List<ItpRecord> records = itpRecordRepository.findByVehicleId(vehicle.getId());
        Long eventId = auditService.recordDeletion(user, EntityType.VEHICLE, vehicle.getId(),
                AuditService.vehicleSummary(vehicle) + " · " + records.size() + " ITP-uri",
                snapshot(client, List.of(vehicle), records));
        deleteRecords(records);
        vehicleRepository.delete(vehicle);
        vehicleRepository.flush();
        if (vehicleRepository.countByClientId(client.getId()) == 0) {
            clientRepository.delete(client);
            return new VehicleDeletion(null, eventId);
        }
        return new VehicleDeletion(detail(client), eventId);
    }

    // Posibile dubluri: acelasi telefon, sau acelasi nume (fara diacritice/majuscule)
    @Transactional(readOnly = true)
    public List<DuplicateGroupDTO> duplicates(AppUser user) {
        List<Client> clients = clientRepository.findByUserIdOrderByIdAsc(user.getId());
        Map<Long, Long> vehicleCounts = new HashMap<>();
        for (Object[] row : vehicleRepository.countByClientForUser(user.getId())) {
            vehicleCounts.put((Long) row[0], ((Number) row[1]).longValue());
        }
        Map<String, List<Client>> byPhone = new LinkedHashMap<>();
        Map<String, List<Client>> byName = new LinkedHashMap<>();
        for (Client c : clients) {
            if (c.getPhoneKey() != null && c.getPhoneKey().length() >= 6) {
                byPhone.computeIfAbsent(c.getPhoneKey(), k -> new ArrayList<>()).add(c);
            }
            String nameKey = ClientKeys.nameKey(c.getName());
            if (!nameKey.isEmpty()) byName.computeIfAbsent(nameKey, k -> new ArrayList<>()).add(c);
        }
        List<DuplicateGroupDTO> groups = new ArrayList<>();
        Set<Set<Long>> seen = new HashSet<>();
        addGroups(groups, seen, byPhone.values(), "Același telefon", vehicleCounts);
        addGroups(groups, seen, byName.values(), "Același nume", vehicleCounts);
        return groups.size() > MAX_DUPLICATE_GROUPS ? groups.subList(0, MAX_DUPLICATE_GROUPS) : groups;
    }

    private static void addGroups(List<DuplicateGroupDTO> out, Set<Set<Long>> seen, Collection<List<Client>> candidates,
                                  String reason, Map<Long, Long> vehicleCounts) {
        for (List<Client> group : candidates) {
            if (group.size() < 2) continue;
            Set<Long> ids = group.stream().map(Client::getId).collect(Collectors.toSet());
            if (!seen.add(ids)) continue;
            out.add(new DuplicateGroupDTO(reason, group.stream()
                    .map(c -> new ClientBriefDTO(c.getId(), c.getName(), c.getPhone(), vehicleCounts.getOrDefault(c.getId(), 0L)))
                    .toList()));
        }
    }

    // ---------- ajutatoare ----------

    private Client find(AppUser user, Long id) {
        return clientRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Client inexistent"));
    }

    private Vehicle findVehicle(AppUser user, Long id) {
        return vehicleRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vehicul inexistent"));
    }

    private static String requireName(String name) {
        String clean = trimToNull(name);
        if (clean == null) throw badRequest("Introduceți numele clientului");
        if (clean.length() > MAX_NAME) throw badRequest("Numele este prea lung");
        return clean.replaceAll("\\s+", " ");
    }

    static String escapeLike(String s) {
        return s.replace("!", "!!").replace("%", "!%").replace("_", "!_");
    }

    private static String trimToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
