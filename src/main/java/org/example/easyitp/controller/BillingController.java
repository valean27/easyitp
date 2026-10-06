package org.example.easyitp.controller;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.service.BillingService;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// Abonamentul statiei (Contul meu → Abonament) si notificarea de plata de la Netopia
@RestController
@RequiredArgsConstructor
@Slf4j
public class BillingController {

    private final BillingService billingService;
    private final CurrentUser currentUser;

    @GetMapping("/api/billing/status")
    public BillingService.Status status() {
        return billingService.status(currentUser.get());
    }

    @PutMapping("/api/billing/details")
    public BillingService.BillingDetails updateDetails(@RequestBody BillingService.BillingDetails request) {
        return billingService.updateDetails(currentUser.get(), request);
    }

    @PostMapping("/api/billing/checkout")
    public BillingService.CheckoutResult checkout(@RequestBody BillingService.CheckoutRequest request) {
        return billingService.checkout(currentUser.get(), request);
    }

    @GetMapping("/api/billing/payments")
    public List<BillingService.PaymentDTO> payments() {
        return billingService.payments(currentUser.get());
    }

    // Dupa intoarcerea din pagina Netopia
    @PostMapping("/api/billing/payments/{orderId}/refresh")
    public BillingService.PaymentDTO refresh(@PathVariable String orderId) {
        return billingService.refresh(currentUser.get(), orderId);
    }

    // IPN: Netopia anunta schimbarea starii; starea reala se citeste de la Netopia, deci corpul nu e de incredere.
    // Raspunsul {"errorType":0} ii spune ca am primit notificarea.
    @PostMapping("/api/public/netopia/ipn")
    public Map<String, Object> ipn(@RequestBody(required = false) JsonNode body) {
        String orderId = body == null ? null : body.path("order").path("orderID").asText(null);
        try {
            billingService.notify(orderId);
        } catch (RuntimeException e) {
            log.error("Notificarea Netopia pentru {} nu a putut fi procesata", orderId, e);
        }
        Map<String, Object> ack = new LinkedHashMap<>();
        ack.put("errorType", 0);
        ack.put("errorCode", null);
        ack.put("errorMessage", "");
        return ack;
    }
}
