package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.FleetDTOs.FleetStatementDTO;
import org.example.easyitp.dto.FleetDTOs.StatementRowDTO;
import org.example.easyitp.dto.InvoicingDTOs.InvoiceDTO;
import org.example.easyitp.dto.InvoicingDTOs.OptionsDTO;
import org.example.easyitp.dto.InvoicingDTOs.SettingsDTO;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Client;
import org.example.easyitp.entity.Fleet;
import org.example.easyitp.entity.Invoice;
import org.example.easyitp.entity.ItpRecord;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.FleetRepository;
import org.example.easyitp.repository.InvoiceRepository;
import org.example.easyitp.repository.ItpRecordRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

// Facturi reale prin Oblio (D3): pentru centralizatorul lunar al unei flote (o linie pe ITP) sau pentru un ITP al
// unei persoane fizice. O singura factura pe flota si luna si pe ITP; daca statia vrea, factura pleaca si in SPV.
@Service
@RequiredArgsConstructor
public class InvoiceService {

    static final String PRODUCT = "Inspecție tehnică periodică (ITP)";
    private static final DateTimeFormatter RO = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final int DEFAULT_DUE_DAYS = 15;

    private final OblioClient oblio;
    private final AppUserRepository appUserRepository;
    private final FleetRepository fleetRepository;
    private final FleetService fleetService;
    private final ItpRecordRepository itpRecordRepository;
    private final InvoiceRepository invoiceRepository;

    // ---------- setari ----------

    public static SettingsDTO settings(AppUser u) {
        return new SettingsDTO(u.getOblioEmail(), null, u.getOblioSecret() != null, u.getOblioCif(), u.getOblioSeries(),
                u.getOblioVatName(), u.getOblioVatPercent(), !Boolean.FALSE.equals(u.getOblioVatIncluded()),
                Boolean.TRUE.equals(u.getOblioEinvoice()), dueDays(u), ready(u));
    }

    @Transactional
    public SettingsDTO update(AppUser user, SettingsDTO r) {
        String email = trim(r.email());
        if (email != null && (email.length() > 200 || !email.contains("@"))) throw badRequest("Emailul contului Oblio nu este valid.");
        // alt cont Oblio: firma, seria si cota de dinainte nu mai sunt valabile
        if (email == null || !email.equalsIgnoreCase(Optional.ofNullable(user.getOblioEmail()).orElse(""))) {
            user.setOblioCif(null);
            user.setOblioSeries(null);
            user.setOblioVatName(null);
            user.setOblioVatPercent(null);
            if (email == null) user.setOblioSecret(null);
        }
        user.setOblioEmail(email);
        if (trim(r.secret()) != null) user.setOblioSecret(r.secret().trim());
        if (r.cif() != null) user.setOblioCif(trim(r.cif()));
        if (r.series() != null) user.setOblioSeries(trim(r.series()));
        if (r.vatName() != null) {
            user.setOblioVatName(trim(r.vatName()));
            user.setOblioVatPercent(r.vatPercent());
        }
        user.setOblioVatIncluded(r.vatIncluded());
        user.setOblioEinvoice(r.einvoice());
        if (r.dueDays() < 0 || r.dueDays() > 120) throw badRequest("Termenul de plată trebuie să fie între 0 și 120 de zile.");
        user.setOblioDueDays(r.dueDays());
        return settings(appUserRepository.save(user));
    }

    // Firmele contului (verifica si emailul + cheia), apoi seriile si cotele firmei alese
    public OptionsDTO options(AppUser user, String cif) {
        requireAccount(user);
        try {
            List<OblioClient.Company> companies = oblio.companies(user.getOblioEmail(), user.getOblioSecret());
            String chosen = trim(cif) != null ? cif.trim() : user.getOblioCif() != null ? user.getOblioCif()
                    : companies.size() == 1 ? companies.get(0).cif() : null;
            if (chosen == null) return new OptionsDTO(companies, List.of(), List.of());
            return new OptionsDTO(companies, oblio.series(user.getOblioEmail(), user.getOblioSecret(), chosen),
                    oblio.vatRates(user.getOblioEmail(), user.getOblioSecret(), chosen));
        } catch (DeliveryException e) {
            throw badRequest(e.getMessage());
        }
    }

    // ---------- facturi ----------

    @Transactional(readOnly = true)
    public Optional<InvoiceDTO> fleetInvoice(AppUser station, Long fleetId, YearMonth month) {
        return invoiceRepository.findByUserIdAndFleetIdAndPeriod(station.getId(), fleetId, month.toString()).map(InvoiceService::dto);
    }

    @Transactional
    public InvoiceDTO issueForFleet(AppUser station, Long fleetId, YearMonth month) {
        requireReady(station);
        Fleet fleet = fleetRepository.findById(fleetId).filter(f -> f.getStation().getId().equals(station.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Firma nu există"));
        invoiceRepository.findByUserIdAndFleetIdAndPeriod(station.getId(), fleetId, month.toString()).ifPresent(i -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Luna aceasta are deja factura " + i.getSeriesName() + " " + i.getNumber() + ".");
        });
        if (fleet.getCui() == null) throw badRequest("Completați CUI-ul firmei (Flote → editează firma).");
        FleetStatementDTO statement = fleetService.statement(station, fleetId, month);
        List<Map<String, Object>> products = new ArrayList<>();
        double total = 0;
        for (StatementRowDTO row : statement.rows()) {
            if (row.price() == null || row.price() <= 0) continue;
            products.add(product(station, row.price(), row.plate().toUpperCase(Locale.ROOT) + " · " + row.date().format(RO)));
            total += row.price();
        }
        if (products.isEmpty()) throw badRequest("Nicio inspecție cu preț în luna aleasă.");

        Map<String, Object> client = new LinkedHashMap<>();
        client.put("cif", fleet.getCui());
        client.put("name", fleet.getName());
        if (fleet.getAddress() != null) client.put("address", fleet.getAddress());
        if (fleet.getCity() != null) client.put("city", fleet.getCity());
        if (fleet.getCounty() != null) client.put("state", fleet.getCounty());
        client.put("country", "Romania");
        if (fleet.getContactPhone() != null) client.put("phone", fleet.getContactPhone());
        client.put("save", true);

        String mentions = "Centralizator ITP " + month.getMonthValue() + "/" + month.getYear() + " (" + products.size() + " inspecții)";
        return issue(station, client, products, mentions, total,
                Invoice.builder().fleetId(fleetId).period(month.toString()).clientName(fleet.getName()));
    }

    @Transactional(readOnly = true)
    public Optional<InvoiceDTO> itpInvoice(AppUser station, Long itpId) {
        return invoiceRepository.findByUserIdAndItpRecordId(station.getId(), itpId).map(InvoiceService::dto);
    }

    // Persoana fizica: doar numele (si telefonul); Oblio completeaza ce cere e-Factura pentru persoane fizice
    @Transactional
    public InvoiceDTO issueForItp(AppUser station, Long itpId) {
        requireReady(station);
        ItpRecord record = itpRecordRepository.findByIdAndUserId(itpId, station.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "ITP-ul nu există"));
        invoiceRepository.findByUserIdAndItpRecordId(station.getId(), itpId).ifPresent(i -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "ITP-ul are deja factura " + i.getSeriesName() + " " + i.getNumber() + ".");
        });
        if (record.getPrice() == null || record.getPrice() <= 0) throw badRequest("ITP-ul nu are preț.");
        Client c = record.getVehicle().getClient();
        Map<String, Object> client = new LinkedHashMap<>();
        client.put("name", c.getName());
        if (c.getPhone() != null) client.put("phone", c.getPhone());
        client.put("country", "Romania");
        List<Map<String, Object>> products = List.of(product(station, record.getPrice(),
                record.getVehicle().getLicensePlate().toUpperCase(Locale.ROOT) + " · " + record.getTestDate().format(RO)));
        return issue(station, client, products, null, record.getPrice(),
                Invoice.builder().itpRecordId(itpId).clientName(c.getName()));
    }

    private InvoiceDTO issue(AppUser station, Map<String, Object> client, List<Map<String, Object>> products, String mentions,
                             double total, Invoice.InvoiceBuilder invoice) {
        LocalDate today = LocalDate.now();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("cif", station.getOblioCif());
        body.put("client", client);
        body.put("issueDate", today.toString());
        body.put("dueDate", today.plusDays(dueDays(station)).toString());
        body.put("seriesName", station.getOblioSeries());
        body.put("language", "RO");
        body.put("precision", 2);
        body.put("currency", "RON");
        body.put("products", products);
        if (mentions != null) body.put("mentions", mentions);
        OblioClient.Issued issued;
        try {
            issued = oblio.createInvoice(station.getOblioEmail(), station.getOblioSecret(), body);
        } catch (DeliveryException e) {
            throw badRequest(e.getMessage());
        }
        Invoice saved = invoiceRepository.save(invoice.userId(station.getId()).seriesName(issued.seriesName())
                .number(issued.number()).link(issued.link()).total(Math.round(total * 100) / 100.0)
                .createdAt(LocalDateTime.now()).build());
        // SPV: o eroare aici nu anuleaza factura deja emisa
        if (Boolean.TRUE.equals(station.getOblioEinvoice())) {
            try {
                saved.setEinvoiceStatus(trimTo(oblio.sendEinvoice(station.getOblioEmail(), station.getOblioSecret(),
                        station.getOblioCif(), issued.seriesName(), issued.number()), 200));
            } catch (DeliveryException e) {
                saved.setEinvoiceStatus(trimTo("Netrimisă în SPV: " + e.getMessage(), 200));
            }
            invoiceRepository.save(saved);
        }
        return dto(saved);
    }

    private static Map<String, Object> product(AppUser station, double price, String description) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("name", PRODUCT);
        p.put("description", description);
        p.put("price", price);
        p.put("measuringUnit", "buc");
        p.put("currency", "RON");
        p.put("vatName", station.getOblioVatName());
        p.put("vatPercentage", station.getOblioVatPercent() != null ? station.getOblioVatPercent() : 0);
        p.put("vatIncluded", !Boolean.FALSE.equals(station.getOblioVatIncluded()));
        p.put("quantity", 1);
        p.put("productType", "Serviciu");
        return p;
    }

    static boolean ready(AppUser u) {
        return u.getOblioEmail() != null && u.getOblioSecret() != null && u.getOblioCif() != null
                && u.getOblioSeries() != null && u.getOblioVatName() != null;
    }

    private static void requireAccount(AppUser u) {
        if (u.getOblioEmail() == null || u.getOblioSecret() == null) {
            throw badRequest("Completați emailul contului Oblio și cheia API.");
        }
    }

    private static void requireReady(AppUser u) {
        if (!ready(u)) throw badRequest("Configurați întâi facturarea (Contul meu → Facturare Oblio): firma, seria și cota TVA.");
    }

    private static int dueDays(AppUser u) {
        return u.getOblioDueDays() != null ? u.getOblioDueDays() : DEFAULT_DUE_DAYS;
    }

    private static InvoiceDTO dto(Invoice i) {
        return new InvoiceDTO(i.getId(), i.getSeriesName(), i.getNumber(), i.getLink(), i.getTotal(), i.getClientName(),
                i.getEinvoiceStatus(), i.getCreatedAt());
    }

    private static String trim(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String trimTo(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
