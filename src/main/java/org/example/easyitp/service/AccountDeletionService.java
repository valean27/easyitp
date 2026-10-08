package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// Datele statiei la cerere (GDPR): exportul complet (JSON) si stergerea contului. Cererea dezactiveaza contul imediat;
// datele se sterg definitiv dupa GRACE_DAYS, in rularea de dimineata (adminul poate anula sau sterge mai devreme).
@Service
@RequiredArgsConstructor
@Slf4j
public class AccountDeletionService {

    public static final int GRACE_DAYS = 30;
    public static final String CONFIRM_TEXT = "STERGE";
    private static final DateTimeFormatter RO = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final JdbcTemplate jdbc;
    private final jakarta.persistence.EntityManager entityManager;

    // Clientii statiei si tot ce tine de ei; fara parole, chei API sau tokenuri de logare
    @Transactional(readOnly = true)
    public Map<String, Object> export(AppUser u) {
        Long id = u.getId();
        Map<String, Object> station = new LinkedHashMap<>();
        station.put("email", u.getEmail());
        station.put("stationName", u.getStationName());
        station.put("address", u.getAddress());
        station.put("phone", u.getPhone());
        station.put("createdAt", u.getCreatedAt());
        station.put("plan", u.getPlan());
        station.put("planUntil", u.getPlanUntil());
        station.put("billingName", u.getBillingName());
        station.put("billingCui", u.getBillingCui());
        station.put("billingAddress", u.getBillingAddress());
        station.put("billingCity", u.getBillingCity());
        station.put("billingCounty", u.getBillingCounty());
        station.put("bookingSlug", u.getBookingSlug());
        station.put("inspectors", jdbc.queryForList("select name, phone, active, default_line from inspectors where user_id = ? order by position", u.getId()));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("exportedAt", LocalDateTime.now());
        out.put("station", station);
        out.put("clients", jdbc.queryForList("select id, name, phone, reminder_consent, consent_at, consent_source from clients "
                + "where user_id = ? order by id", id));
        out.put("vehicles", jdbc.queryForList("select v.* from vehicles v join clients c on c.id = v.client_id "
                + "where c.user_id = ? order by v.id", id));
        out.put("vehicleDeadlines", jdbc.queryForList("select d.* from vehicle_deadlines d join vehicles v on v.id = d.vehicle_id "
                + "join clients c on c.id = v.client_id where c.user_id = ?", id));
        out.put("itpRecords", jdbc.queryForList("select r.* from itp_records r join vehicles v on v.id = r.vehicle_id "
                + "join clients c on c.id = v.client_id where c.user_id = ? order by r.id", id));
        out.put("appointments", jdbc.queryForList("select id, client_name, phone, license_plate, appointment_date, status, source, "
                + "vehicle_category, duration_minutes, reminder_consent, itp_record_id, client_action, created_at from appointments where user_id = ? order by id", id));
        out.put("fleets", jdbc.queryForList("select * from fleets where user_id = ? order by id", id));
        out.put("fleetPlates", jdbc.queryForList("select p.* from fleet_plates p join fleets f on f.id = p.fleet_id where f.user_id = ?", id));
        out.put("stationDeadlines", jdbc.queryForList("select * from station_deadlines where user_id = ? order by id", id));
        out.put("invoices", jdbc.queryForList("select * from invoices where user_id = ? order by id", id));
        out.put("payments", jdbc.queryForList("select order_id, plan, sms_plan, months, amount, status, created_at, paid_at, "
                + "plan_until, invoice_number, invoice_link from payments where user_id = ? order by id", id));
        out.put("history", jdbc.queryForList("select created_at, actor, action, entity_type, summary, changes from audit_events "
                + "where user_id = ? order by created_at", id));
        return out;
    }

    // Cererea statiei: parola + cuvantul de confirmare; contul se inchide imediat (toate sesiunile)
    @Transactional
    public LocalDateTime requestDeletion(AppUser u, String password, String confirm) {
        if (u.getRole() != Role.MANAGER) throw badRequest("Doar contul unei stații se poate șterge de aici.");
        if (password == null || !passwordEncoder.matches(password, u.getPassword())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Parola este greșită.");
        }
        if (confirm == null || !CONFIRM_TEXT.equalsIgnoreCase(confirm.trim().replace("Ș", "S").replace("ș", "s"))) {
            throw badRequest("Scrieți " + CONFIRM_TEXT + " ca să confirmați.");
        }
        LocalDateTime now = LocalDateTime.now();
        u.setDeletionRequestedAt(now);
        u.setActive(false);
        u.revokeTokens();
        appUserRepository.save(u);
        LocalDateTime purgeAt = now.plusDays(GRACE_DAYS);
        notifyStation(u, purgeAt);
        log.info("Statia {} a cerut stergerea contului (definitiv dupa {})", u.getId(), purgeAt.toLocalDate());
        return purgeAt;
    }

    // Adminul anuleaza cererea (ex. ceruta din greseala): contul revine activ
    @Transactional
    public void cancel(AppUser u) {
        u.setDeletionRequestedAt(null);
        u.setActive(true);
        appUserRepository.save(u);
    }

    // Rularea de dimineata: conturile cu cererea mai veche de GRACE_DAYS
    public int purgeDue(LocalDateTime now) {
        int purged = 0;
        for (AppUser u : appUserRepository.findByRoleOrderByIdAsc(Role.MANAGER)) {
            if (u.getDeletionRequestedAt() != null && u.getDeletionRequestedAt().isBefore(now.minusDays(GRACE_DAYS))) {
                hardDelete(u.getId());
                purged++;
            }
        }
        if (purged > 0) log.info("Conturi sterse definitiv: {}", purged);
        return purged;
    }

    // Sterge statia cu tot ce are: clienti, masini, ITP-uri, programari, flote (si conturile lor), istoric, facturi
    @Transactional
    public void hardDelete(Long id) {
        // ce e incarcat in sesiunea JPA se scrie acum si apoi se uita, ca Hibernate sa nu mai scrie peste randurile sterse
        entityManager.flush();
        entityManager.clear();
        String clients = "select id from clients where user_id = ?";
        String vehicles = "select v.id from vehicles v join clients c on c.id = v.client_id where c.user_id = ?";
        String fleets = "select id from fleets where user_id = ?";
        jdbc.update("delete from reminder_sends where user_id = ?", id);
        jdbc.update("delete from audit_events where user_id = ?", id);
        jdbc.update("delete from appointments where user_id = ?", id);
        jdbc.update("delete from itp_records where vehicle_id in (" + vehicles + ")", id);
        jdbc.update("delete from vehicle_deadlines where vehicle_id in (" + vehicles + ")", id);
        jdbc.update("delete from vehicles where client_id in (" + clients + ")", id);
        jdbc.update("delete from clients where user_id = ?", id);
        jdbc.update("delete from auth_tokens where user_id in (select id from app_users where fleet_id in (" + fleets + "))", id);
        jdbc.update("delete from app_users where fleet_id in (" + fleets + ")", id);
        jdbc.update("delete from fleet_plates where fleet_id in (" + fleets + ")", id);
        jdbc.update("delete from invoices where user_id = ?", id);
        jdbc.update("delete from fleets where user_id = ?", id);
        jdbc.update("delete from station_deadlines where user_id = ?", id);
        jdbc.update("delete from payments where user_id = ?", id);
        jdbc.update("delete from sms_usage where user_id = ?", id);
        jdbc.update("delete from auth_tokens where user_id = ?", id);
        jdbc.update("delete from line_shifts where user_id = ?", id);
        jdbc.update("delete from notifications where user_id = ?", id);
        jdbc.update("delete from station_logos where user_id = ?", id);
        jdbc.update("delete from inspector_leaves where user_id = ?", id);
        jdbc.update("delete from station_closed_days where user_id = ?", id);
        jdbc.update("delete from app_users where inspector_id in (select i.id from inspectors i where i.user_id = ?)", id);
        jdbc.update("delete from inspector_days where inspector_id in (select i.id from inspectors i where i.user_id = ?)", id);
        jdbc.update("delete from inspectors where user_id = ?", id);
        // cererea de retragere ramane (dovada primirii), fara legatura cu contul sters
        jdbc.update("update withdrawals set user_id = null where user_id = ?", id);
        jdbc.update("delete from app_users where id = ? and role = 'MANAGER'", id);
    }

    private void notifyStation(AppUser u, LocalDateTime purgeAt) {
        if (!emailService.isConfigured()) return;
        String html = AccountMail.html("Am primit cererea de ștergere a contului", new String[]{
                "Contul Easy ITP " + u.getEmail() + " a fost închis. Datele stației (clienți, mașini, ITP-uri, programări) se "
                        + "șterg definitiv pe " + purgeAt.format(RO) + ".",
                "Dacă ați cerut ștergerea din greșeală, scrieți-ne până atunci și redeschidem contul cu toate datele.",
        }, null, null, "Dacă nu ați cerut dumneavoastră ștergerea, scrieți-ne imediat.");
        try {
            emailService.send(u.getEmail(), "Easy ITP – contul va fi șters pe " + purgeAt.format(RO), html);
        } catch (DeliveryException e) {
            log.warn("Emailul despre stergerea contului {} nu a plecat: {}", u.getId(), e.getMessage());
        }
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
