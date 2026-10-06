package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Payment;
import org.example.easyitp.entity.PaymentStatus;
import org.example.easyitp.entity.Plan;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.PaymentRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Abonamentul statiei (E1): starea, datele de facturare, plata prin Netopia (pornire, confirmare din notificare sau
// la intoarcerea din pagina de plata) si factura emisa de platforma prin Oblio (daca e configurata).
@Service
@RequiredArgsConstructor
@Slf4j
public class BillingService {

    private final AppUserRepository appUserRepository;
    private final PaymentRepository paymentRepository;
    private final NetopiaClient netopia;
    private final OblioClient oblio;

    @Value("${app.url:https://easyitp.vercel.app}")
    private String appUrl;

    @Value("${api.url:https://easyitp.onrender.com}")
    private String apiUrl;

    // Facturile abonamentelor: contul Oblio al platformei (doar variabile de mediu); fara ele factura se face manual
    @Value("${platform.oblio.email:}")
    private String oblioEmail;
    @Value("${platform.oblio.secret:}")
    private String oblioSecret;
    @Value("${platform.oblio.cif:}")
    private String oblioCif;
    @Value("${platform.oblio.series:}")
    private String oblioSeries;

    public record BillingDetails(String name, String cui, String address, String city, String county) {
    }

    public record Status(String plan, String paidPlan, LocalDate planUntil, boolean trial, Long daysLeft, int smsPlan,
                         List<String> features, Map<String, Integer> prices, Map<String, Integer> smsPrices,
                         int vatPercent, boolean paymentsAvailable, BillingDetails billing) {
    }

    public record CheckoutRequest(String plan, Integer smsPlan, Integer months) {
    }

    public record CheckoutResult(String orderId, String paymentUrl) {
    }

    public record PaymentDTO(String orderId, String plan, int smsPlan, int months, BigDecimal amount, String status,
                             LocalDateTime createdAt, LocalDateTime paidAt, LocalDate planUntil, String invoiceNumber,
                             String invoiceLink) {
    }

    public Status status(AppUser u) {
        LocalDate today = LocalDate.now();
        Plan effective = Plans.effective(u, today);
        Long daysLeft = u.getPlan() == null || u.getPlanUntil() == null || effective == Plan.FREE ? null
                : ChronoUnit.DAYS.between(today, u.getPlanUntil());
        Map<String, Integer> prices = new LinkedHashMap<>();
        for (Plan p : Plan.values()) prices.put(p.name(), Plans.prices().get(p));
        Map<String, Integer> sms = new LinkedHashMap<>();
        for (Integer s : SmsQuotaService.PLANS) sms.put(String.valueOf(s), Plans.smsPrices().get(s));
        return new Status(effective.name(), u.getPlan() == null ? Plan.PREMIUM.name() : u.getPlan().name(), u.getPlanUntil(),
                Plans.onTrial(u, today), daysLeft, SmsQuotaService.plan(u), Plans.features(u), prices, sms,
                Plans.VAT_PERCENT.intValue(), netopia.available(), details(u));
    }

    private static BillingDetails details(AppUser u) {
        return new BillingDetails(u.getBillingName(), u.getBillingCui(), u.getBillingAddress(), u.getBillingCity(), u.getBillingCounty());
    }

    @Transactional
    public BillingDetails updateDetails(AppUser u, BillingDetails d) {
        String name = clean(d.name(), 200);
        String cui = clean(d.cui(), 30);
        if (name == null) throw badRequest("Completați numele firmei.");
        if (cui != null) {
            cui = cui.toUpperCase().replaceAll("\\s", "");
            if (!cui.matches("(RO)?\\d{2,10}")) throw badRequest("CUI-ul are forma RO12345678 sau 12345678.");
        }
        u.setBillingName(name);
        u.setBillingCui(cui);
        u.setBillingAddress(clean(d.address(), 200));
        u.setBillingCity(clean(d.city(), 80));
        u.setBillingCounty(clean(d.county(), 80));
        appUserRepository.save(u);
        return details(u);
    }

    @Transactional
    public CheckoutResult checkout(AppUser u, CheckoutRequest req) {
        if (!netopia.available()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Plata online nu este încă disponibilă. Scrieți-ne și activăm pachetul manual.");
        }
        Plan plan = parsePlan(req.plan());
        if (plan == Plan.FREE) throw badRequest("Pachetul Gratuit nu se plătește.");
        int sms = req.smsPlan() == null ? 0 : req.smsPlan();
        int months = req.months() == null ? 1 : req.months();
        if (!Plans.validSms(sms)) throw badRequest("Pachet SMS invalid.");
        if (!Plans.MONTH_OPTIONS.contains(months)) throw badRequest("Alegeți 1 sau 12 luni.");
        if (u.getBillingName() == null || u.getBillingCity() == null || u.getBillingAddress() == null) {
            throw badRequest("Completați întâi datele de facturare (firmă, adresă, oraș).");
        }
        BigDecimal amount = Plans.amount(plan, sms, months);
        String orderId = "EI" + u.getId() + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        Payment payment = paymentRepository.save(Payment.builder().userId(u.getId()).orderId(orderId).plan(plan)
                .smsPlan(sms).months(months).amount(amount).status(PaymentStatus.PENDING).createdAt(LocalDateTime.now()).build());
        NetopiaClient.Started started;
        try {
            started = netopia.start(orderId, amount, description(plan, sms, months),
                    new NetopiaClient.Billing(u.getEmail(), u.getPhone() == null ? "" : u.getPhone(), u.getBillingName(),
                            u.getBillingAddress(), u.getBillingCity(), u.getBillingCounty()),
                    stripSlash(apiUrl) + "/api/public/netopia/ipn",
                    stripSlash(appUrl) + "/plata?order=" + orderId);
        } catch (DeliveryException e) {
            payment.setStatus(PaymentStatus.FAILED);
            paymentRepository.save(payment);
            throw badRequest(e.getMessage());
        }
        payment.setNtpId(started.ntpId());
        paymentRepository.save(payment);
        return new CheckoutResult(orderId, started.paymentUrl());
    }

    // Intoarcerea din pagina de plata: intrebam Netopia de stare (doar platile statiei logate)
    @Transactional
    public PaymentDTO refresh(AppUser u, String orderId) {
        Payment p = paymentRepository.findByOrderId(orderId).filter(x -> x.getUserId().equals(u.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Plata nu există."));
        return dto(confirm(p.getOrderId()));
    }

    // Notificarea Netopia (IPN): nu ne bazam pe continutul ei, ci verificam starea direct la Netopia
    @Transactional
    public void notify(String orderId) {
        if (orderId == null || paymentRepository.findByOrderId(orderId).isEmpty()) return;
        confirm(orderId);
    }

    // Aplica plata o singura data (blocare pe rand); intoarce plata actualizata
    Payment confirm(String orderId) {
        Payment p = paymentRepository.lockByOrderId(orderId).orElseThrow();
        if (p.getStatus() != PaymentStatus.PENDING) return p;
        int status;
        try {
            status = netopia.status(p.getNtpId(), p.getOrderId());
        } catch (DeliveryException e) {
            log.warn("Starea platii {} nu a putut fi citita: {}", orderId, e.getMessage());
            return p;
        }
        if (NetopiaClient.isFailed(status)) {
            p.setStatus(PaymentStatus.FAILED);
            return paymentRepository.save(p);
        }
        if (!NetopiaClient.isPaid(status)) return p;

        AppUser u = appUserRepository.findById(p.getUserId()).orElseThrow();
        LocalDate until = applyPaid(u, p.getPlan(), p.getSmsPlan(), p.getMonths(), LocalDate.now());
        appUserRepository.save(u);
        p.setStatus(PaymentStatus.PAID);
        p.setPaidAt(LocalDateTime.now());
        p.setPlanUntil(until);
        issueInvoice(u, p);
        log.info("Plata {} confirmata: statia {} are {} pana la {}", orderId, u.getId(), p.getPlan(), until);
        return paymentRepository.save(p);
    }

    // Noua perioada platita. Acelasi pachet: se adauga dupa ultima zi platita. Alt pachet: incepe azi, iar zilele
    // ramase din cel vechi se transforma in zile din cel nou, dupa pret. In proba: incepe dupa ultima zi de proba.
    static LocalDate applyPaid(AppUser u, Plan plan, int sms, int months, LocalDate today) {
        boolean paidActive = u.getPlan() != null && u.getPlan() != Plan.FREE && !Boolean.TRUE.equals(u.getPlanTrial())
                && u.getPlanUntil() != null && !u.getPlanUntil().isBefore(today);
        LocalDate start = today;
        long extraDays = 0;
        boolean trialActive = Boolean.TRUE.equals(u.getPlanTrial()) && u.getPlanUntil() != null && u.getPlanUntil().isAfter(today);
        if (trialActive) {
            start = u.getPlanUntil();
        } else if (paidActive) {
            int oldSms = u.getSmsPlan() == null ? 0 : u.getSmsPlan();
            if (u.getPlan() == plan && oldSms == sms) {
                start = u.getPlanUntil();
            } else {
                long remaining = ChronoUnit.DAYS.between(today, u.getPlanUntil());
                extraDays = remaining * Plans.monthlyPrice(u.getPlan(), oldSms) / Plans.monthlyPrice(plan, sms);
            }
        }
        LocalDate until = start.plusMonths(months).plusDays(extraDays);
        u.setPlan(plan);
        u.setSmsPlan(sms);
        u.setPlanUntil(until);
        u.setPlanTrial(false);
        return until;
    }

    // Factura abonamentului din contul Oblio al platformei; o eroare nu anuleaza plata (se emite manual)
    private void issueInvoice(AppUser u, Payment p) {
        if (blank(oblioEmail) || blank(oblioSecret) || blank(oblioCif) || blank(oblioSeries)) return;
        try {
            Map<String, Object> client = new LinkedHashMap<>();
            if (u.getBillingCui() != null) client.put("cif", u.getBillingCui());
            client.put("name", u.getBillingName());
            if (u.getBillingAddress() != null) client.put("address", u.getBillingAddress());
            if (u.getBillingCity() != null) client.put("city", u.getBillingCity());
            if (u.getBillingCounty() != null) client.put("state", u.getBillingCounty());
            client.put("country", "Romania");
            client.put("email", u.getEmail());
            client.put("save", true);

            int billed = Plans.billedMonths(p.getMonths());
            String period = p.getMonths() == 1 ? "1 lună" : p.getMonths() + " luni";
            List<Map<String, Object>> products = new ArrayList<>();
            products.add(product("Abonament Easy ITP " + p.getPlan().label(), period + " · până la " + p.getPlanUntil(),
                    Plans.prices().get(p.getPlan()) * billed));
            if (p.getSmsPlan() > 0) {
                products.add(product("Pachet " + p.getSmsPlan() + " SMS / lună", period, Plans.smsPrices().get(p.getSmsPlan()) * billed));
            }
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("cif", oblioCif);
            body.put("client", client);
            body.put("issueDate", LocalDate.now().toString());
            body.put("seriesName", oblioSeries);
            body.put("language", "RO");
            body.put("precision", 2);
            body.put("currency", "RON");
            body.put("products", products);
            body.put("mentions", "Plătit online cu cardul (Netopia), comanda " + p.getOrderId());
            OblioClient.Issued issued = oblio.createInvoice(oblioEmail, oblioSecret, body);
            p.setInvoiceNumber(issued.seriesName() + " " + issued.number());
            p.setInvoiceLink(issued.link());
            if (u.getBillingCui() != null) {
                try {
                    oblio.sendEinvoice(oblioEmail, oblioSecret, oblioCif, issued.seriesName(), issued.number());
                } catch (DeliveryException e) {
                    p.setInvoiceError(trim("Netrimisă în SPV: " + e.getMessage(), 300));
                }
            }
        } catch (DeliveryException e) {
            log.warn("Factura pentru plata {} nu a fost emisa: {}", p.getOrderId(), e.getMessage());
            p.setInvoiceError(trim(e.getMessage(), 300));
        }
    }

    private static Map<String, Object> product(String name, String description, int price) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", name);
        m.put("description", description);
        m.put("price", price);
        m.put("measuringUnit", "buc");
        m.put("currency", "RON");
        m.put("vatName", "Normala");
        m.put("vatPercentage", Plans.VAT_PERCENT.intValue());
        m.put("vatIncluded", false);
        m.put("quantity", 1);
        m.put("productType", "Serviciu");
        return m;
    }

    public List<PaymentDTO> payments(AppUser u) {
        return paymentRepository.findByUserIdOrderByCreatedAtDesc(u.getId(), PageRequest.of(0, 50)).stream()
                .map(BillingService::dto).toList();
    }

    public static PaymentDTO dto(Payment p) {
        return new PaymentDTO(p.getOrderId(), p.getPlan().name(), p.getSmsPlan(), p.getMonths(), p.getAmount(),
                p.getStatus().name(), p.getCreatedAt(), p.getPaidAt(), p.getPlanUntil(), p.getInvoiceNumber(), p.getInvoiceLink());
    }

    // Abonament dat de admin (ex. platit prin transfer): pachet + ultima zi (null = fara expirare)
    @Transactional
    public void grant(AppUser u, Plan plan, LocalDate until) {
        u.setPlan(plan);
        u.setPlanUntil(plan == Plan.FREE ? null : until);
        u.setPlanTrial(false);
        appUserRepository.save(u);
    }

    // Cont nou (inscriere sau creat de admin): Premium de proba
    public static void startTrial(AppUser u, LocalDate today) {
        u.setPlan(Plan.PREMIUM);
        u.setPlanUntil(today.plusDays(Plans.TRIAL_DAYS));
        u.setPlanTrial(true);
    }

    static String description(Plan plan, int sms, int months) {
        return "Easy ITP " + plan.label() + (sms > 0 ? " + " + sms + " SMS" : "") + ", " + (months == 1 ? "1 lună" : months + " luni");
    }

    public static Plan parsePlan(String raw) {
        try {
            return Plan.valueOf(raw == null ? "" : raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw badRequest("Pachet invalid.");
        }
    }

    private static String stripSlash(String s) {
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static String trim(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }

    private static String clean(String s, int max) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
