package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Payment;
import org.example.easyitp.entity.PaymentStatus;
import org.example.easyitp.entity.PlatformSettings;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.PaymentRepository;
import org.example.easyitp.repository.PlatformSettingsRepository;
import org.example.easyitp.security.SecretBox;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

// Facturile abonamentelor (emise de platforma) prin FGO, cu setarile din pagina adminului. O eroare nu anuleaza
// plata: se pastreaza pe plata, iar adminul reemite factura din lista de plati.
@Slf4j
@Service
@RequiredArgsConstructor
public class PlatformInvoiceService {

    private final PlatformSettingsRepository settingsRepository;
    private final PaymentRepository paymentRepository;
    private final AppUserRepository appUserRepository;
    private final FgoClient fgo;
    private final SecretBox secretBox;

    @Value("${app.url:https://easyitp.vercel.app}")
    private String appUrl;

    // Ce vede adminul (cheia niciodata: doar daca exista)
    public record SettingsDTO(String cui, String series, boolean test, boolean markPaid, String paymentType, boolean hasKey,
                              boolean keyUnreadable, boolean configured) {
    }

    // key: null / gol = ramane cea salvata
    public record SettingsRequest(String cui, String key, String series, Boolean test, Boolean markPaid, String paymentType) {
    }

    @Transactional(readOnly = true)
    public SettingsDTO settings() {
        PlatformSettings s = load();
        boolean hasKey = s.getFgoKey() != null;
        boolean unreadable = hasKey && secretBox.decrypt(s.getFgoKey()) == null;
        return new SettingsDTO(s.getFgoCui(), s.getFgoSeries(), Boolean.TRUE.equals(s.getFgoTest()), Boolean.TRUE.equals(s.getFgoMarkPaid()),
                s.getFgoPaymentType() != null ? s.getFgoPaymentType() : "Card", hasKey, unreadable, configured(s));
    }

    @Transactional
    public SettingsDTO save(SettingsRequest r) {
        PlatformSettings s = load();
        String cui = clean(r.cui(), 20);
        if (cui != null && !cui.toUpperCase(Locale.ROOT).matches("^(RO)?\\d{2,10}$")) throw bad("CUI-ul nu e valid (ex. RO48267925).");
        String series = clean(r.series(), 20);
        if (series != null && !series.matches("^[A-Za-z0-9-]{1,20}$")) throw bad("Seria poate avea doar litere, cifre și cratime.");
        s.setFgoCui(cui == null ? null : cui.toUpperCase(Locale.ROOT));
        s.setFgoSeries(series == null ? null : series.toUpperCase(Locale.ROOT));
        if (r.key() != null && !r.key().isBlank()) {
            String key = r.key().trim();
            if (key.length() > 200) throw bad("Cheia e prea lungă.");
            s.setFgoKey(secretBox.encrypt(key));
        }
        if (r.test() != null) s.setFgoTest(r.test());
        if (r.markPaid() != null) s.setFgoMarkPaid(r.markPaid());
        String type = clean(r.paymentType(), 50);
        s.setFgoPaymentType(type);
        s.setUpdatedAt(LocalDateTime.now());
        settingsRepository.save(s);
        return settings();
    }

    // Sterge cheia (FGO oprit)
    @Transactional
    public SettingsDTO removeKey() {
        PlatformSettings s = load();
        s.setFgoKey(null);
        s.setUpdatedAt(LocalDateTime.now());
        settingsRepository.save(s);
        return settings();
    }

    // Proba conexiunii: raspunsul FGO pentru o factura inexistenta
    @Transactional(readOnly = true)
    public String test() {
        PlatformSettings s = load();
        if (!configured(s)) throw bad("Completați CUI-ul, cheia și seria.");
        return fgo.probe(baseUrl(s), s.getFgoCui(), key(s), appUrl, s.getFgoSeries());
    }

    @Transactional(readOnly = true)
    public boolean active() {
        return configured(load());
    }

    // Emite factura unei plati platite (dupa confirmare sau din admin); o plata cu factura nu primeste alta
    public void issue(AppUser u, Payment p) {
        PlatformSettings s = load();
        if (!configured(s)) return;
        if (p.getInvoiceNumber() != null) return;
        try {
            Map<String, Object> body = invoiceBody(u, p, s.getFgoSeries());
            FgoClient.Issued issued = fgo.issue(baseUrl(s), s.getFgoCui(), key(s), appUrl, body);
            p.setInvoiceNumber((issued.series() + " " + issued.number()).trim());
            p.setInvoiceLink(issued.link());
            p.setInvoiceError(null);
            if (Boolean.TRUE.equals(s.getFgoMarkPaid())) {
                try {
                    LocalDateTime paidAt = p.getPaidAt() != null ? p.getPaidAt() : LocalDateTime.now();
                    fgo.markPaid(baseUrl(s), s.getFgoCui(), key(s), appUrl, issued,
                            s.getFgoPaymentType() != null ? s.getFgoPaymentType() : "Card",
                            p.getAmount().setScale(2, java.math.RoundingMode.HALF_UP).toPlainString(),
                            paidAt.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
                } catch (DeliveryException e) {
                    p.setInvoiceError(trim("Factura e emisă, dar încasarea nu s-a înregistrat: " + e.getMessage()));
                }
            }
        } catch (DeliveryException e) {
            log.warn("Factura FGO pentru plata {} nu a fost emisa: {}", p.getOrderId(), e.getMessage());
            p.setInvoiceError(trim(e.getMessage()));
        }
    }

    // Din admin: emite (sau reemite dupa o eroare) factura unei plati
    @Transactional
    public Payment issueFromAdmin(String orderId) {
        Payment p = paymentRepository.lockByOrderId(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Plata nu există."));
        if (p.getStatus() != PaymentStatus.PAID) throw bad("Plata nu e încasată.");
        if (p.getInvoiceNumber() != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Plata are deja factura " + p.getInvoiceNumber() + ".");
        if (!active()) throw bad("Setați întâi facturarea prin FGO.");
        AppUser u = appUserRepository.findById(p.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Stația nu mai există."));
        issue(u, p);
        return paymentRepository.save(p);
    }

    // Corpul facturii FGO: cumparatorul = stația (datele de facturare din abonament), produsele = pachetul si SMS-urile,
    // cu TVA inclus in pret; IdExtern = comanda, ca o retrimitere sa nu dubleze factura
    Map<String, Object> invoiceBody(AppUser u, Payment p, String series) {
        String name = firstNonBlank(u.getBillingName(), u.getStationName(), u.getEmail());
        String cui = u.getBillingCui() == null ? null : u.getBillingCui().replace(" ", "").toUpperCase(Locale.ROOT);
        Map<String, Object> client = new LinkedHashMap<>();
        client.put("Denumire", name);
        if (cui != null && !cui.isBlank()) {
            client.put("CodUnic", cui);
            client.put("Tip", "PJ");
            client.put("PlatitorTVA", cui.startsWith("RO"));
        } else {
            client.put("Tip", "PF");
        }
        client.put("Tara", "RO");
        if (u.getBillingCounty() != null) client.put("Judet", plain(u.getBillingCounty()));
        if (u.getBillingCity() != null) client.put("Localitate", plain(u.getBillingCity()));
        if (u.getBillingAddress() != null) client.put("Adresa", u.getBillingAddress());
        client.put("Email", u.getEmail());

        int billed = Plans.billedMonths(p.getMonths());
        String period = (p.getMonths() == 1 ? "1 lună" : p.getMonths() + " luni")
                + (p.getPlanUntil() != null ? ", până la " + p.getPlanUntil().format(DateTimeFormatter.ofPattern("dd.MM.yyyy")) : "");
        List<Map<String, Object>> lines = new ArrayList<>();
        lines.add(line("Abonament Easy ITP " + p.getPlan().label(), period, Plans.prices().get(p.getPlan()) * billed));
        if (p.getSmsPlan() != null && p.getSmsPlan() > 0) {
            lines.add(line("Pachet " + p.getSmsPlan() + " SMS / lună", period, Plans.smsPrices().get(p.getSmsPlan()) * billed));
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("Serie", series);
        body.put("Valuta", "RON");
        body.put("TipFactura", "Factura");
        body.put("DataEmitere", LocalDate.now().toString());
        body.put("IdExtern", p.getOrderId().length() > 36 ? p.getOrderId().substring(0, 36) : p.getOrderId());
        body.put("VerificareDuplicat", true);
        body.put("Text", "Plătit online cu cardul (NETOPIA Payments), comanda " + p.getOrderId());
        body.put("Client", client);
        body.put("Continut", lines);
        return body;
    }

    private static Map<String, Object> line(String name, String description, int totalWithVat) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("Denumire", name);
        m.put("Descriere", description);
        m.put("NrProduse", 1);
        m.put("UM", "BUC");
        m.put("CotaTVA", Plans.VAT_PERCENT.intValue());
        // pretul cu TVA (calcul invers in FGO), ca totalul sa fie exact cat s-a platit
        m.put("PretTotal", BigDecimal.valueOf(totalWithVat).setScale(2));
        return m;
    }

    private PlatformSettings load() {
        return settingsRepository.findById(PlatformSettings.ID).orElseGet(() -> PlatformSettings.builder().id(PlatformSettings.ID).build());
    }

    private boolean configured(PlatformSettings s) {
        return s.getFgoCui() != null && s.getFgoSeries() != null && s.getFgoKey() != null && secretBox.decrypt(s.getFgoKey()) != null;
    }

    private String key(PlatformSettings s) {
        return secretBox.decrypt(s.getFgoKey());
    }

    private static String baseUrl(PlatformSettings s) {
        return Boolean.TRUE.equals(s.getFgoTest()) ? FgoClient.TEST : FgoClient.PRODUCTION;
    }

    // Judetul si localitatea fara diacritice, ca in nomenclatorul FGO ("Maramureș" -> "Maramures")
    static String plain(String text) {
        return Normalizer.normalize(text.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) if (v != null && !v.isBlank()) return v.trim();
        return "Client";
    }

    private static String clean(String s, int max) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }

    private static String trim(String s) {
        return s.length() > 300 ? s.substring(0, 299) + "…" : s;
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
