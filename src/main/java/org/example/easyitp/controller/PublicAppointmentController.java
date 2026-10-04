package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.service.AppointmentSelfService;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

// Link-ul clientului din SMS (/p/{token}, fara login): vede, anuleaza sau muta programarea
@RestController
@RequestMapping("/api/public/appointments/{token}")
@RequiredArgsConstructor
public class PublicAppointmentController {

    private final AppointmentSelfService selfService;

    @GetMapping
    public AppointmentSelfService.ManageView view(@PathVariable String token) {
        return selfService.view(token);
    }

    @PostMapping("/cancel")
    public AppointmentSelfService.ManageView cancel(@PathVariable String token) {
        return selfService.cancel(token);
    }

    @GetMapping("/slots")
    public List<LocalTime> slots(@PathVariable String token, @RequestParam String date) {
        return selfService.slots(token, LocalDate.parse(date));
    }

    @PostMapping("/reschedule")
    public AppointmentSelfService.ManageView reschedule(@PathVariable String token, @RequestBody Map<String, String> body) {
        String when = body == null ? null : body.get("appointmentDate");
        return selfService.reschedule(token, when == null ? null : LocalDateTime.parse(when));
    }
}
