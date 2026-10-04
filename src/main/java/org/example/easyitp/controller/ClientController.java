package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.ClientDTOs.ClientDetailDTO;
import org.example.easyitp.dto.ClientDTOs.ClientPageDTO;
import org.example.easyitp.dto.ClientDTOs.ClientUpdateRequest;
import org.example.easyitp.dto.ClientDTOs.ConsentRequest;
import org.example.easyitp.dto.ClientDTOs.DuplicateGroupDTO;
import org.example.easyitp.dto.ClientDTOs.TargetClientRequest;
import org.example.easyitp.dto.ClientDTOs.VehicleUpdateRequest;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.service.ClientService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

// Clientii statiei si masinile lor (pagina "Clienti")
@RestController
@RequestMapping("/api/clients")
@RequiredArgsConstructor
public class ClientController {

    private final ClientService clientService;
    private final CurrentUser currentUser;

    @GetMapping
    public ClientPageDTO list(@RequestParam(defaultValue = "") String q,
                              @RequestParam(defaultValue = "0") int page,
                              @RequestParam(defaultValue = "30") int size) {
        return clientService.list(currentUser.get(), q, page, size);
    }

    @GetMapping("/duplicates")
    public List<DuplicateGroupDTO> duplicates() {
        return clientService.duplicates(currentUser.get());
    }

    @GetMapping("/{id}")
    public ClientDetailDTO get(@PathVariable Long id) {
        return clientService.get(currentUser.get(), id);
    }

    @PutMapping("/{id}")
    public ClientDetailDTO update(@PathVariable Long id, @RequestBody ClientUpdateRequest request) {
        return clientService.update(currentUser.get(), id, request);
    }

    // Acordul pentru remindere, marcat de statie (null = necunoscut)
    @PutMapping("/{id}/consent")
    public ClientDetailDTO consent(@PathVariable Long id, @RequestBody ConsentRequest request) {
        return clientService.updateConsent(currentUser.get(), id, request == null ? null : request.consent());
    }

    // Clientul {id} e aceeasi persoana cu clientId: masinile trec la clientId, {id} dispare
    @PostMapping("/{id}/merge")
    public ClientDetailDTO merge(@PathVariable Long id, @RequestBody TargetClientRequest request) {
        return clientService.merge(currentUser.get(), id, requireTarget(request));
    }

    // Antetul X-Audit-Event = intrarea din istoric, pentru butonul "Anuleaza"
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        Long eventId = clientService.delete(currentUser.get(), id);
        return ResponseEntity.noContent().header(HistoryController.EVENT_HEADER, String.valueOf(eventId)).build();
    }

    @PutMapping("/vehicles/{vehicleId}")
    public ClientDetailDTO updateVehicle(@PathVariable Long vehicleId, @RequestBody VehicleUpdateRequest request) {
        return clientService.updateVehicle(currentUser.get(), vehicleId, request);
    }

    @PostMapping("/vehicles/{vehicleId}/move")
    public ClientDetailDTO moveVehicle(@PathVariable Long vehicleId, @RequestBody TargetClientRequest request) {
        return clientService.moveVehicle(currentUser.get(), vehicleId, requireTarget(request));
    }

    // 204 cand clientul a ramas fara masini si a fost sters odata cu ultima masina
    @DeleteMapping("/vehicles/{vehicleId}")
    public ResponseEntity<ClientDetailDTO> deleteVehicle(@PathVariable Long vehicleId) {
        ClientService.VehicleDeletion deletion = clientService.deleteVehicle(currentUser.get(), vehicleId);
        String eventId = String.valueOf(deletion.eventId());
        return deletion.client() == null
                ? ResponseEntity.noContent().header(HistoryController.EVENT_HEADER, eventId).build()
                : ResponseEntity.ok().header(HistoryController.EVENT_HEADER, eventId).body(deletion.client());
    }

    private static Long requireTarget(TargetClientRequest request) {
        if (request == null || request.clientId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Alegeți clientul");
        }
        return request.clientId();
    }
}
