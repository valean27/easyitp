package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Plan;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;

// Rularea zilnica: emailuri catre statie cand proba sau abonamentul expira curand (cu 3 zile inainte) si dupa ce a
// expirat (statia trece pe Gratuit). Abonamentul nu se reinnoieste singur, deci fara ele s-ar pierde plati.
// Un singur email pe etapa si pe data de expirare (AppUser.planNotice).
@Service
@RequiredArgsConstructor
@Slf4j
public class PlanNoticeService {

    static final int SOON_DAYS = 3;
    // Dupa expirare anuntam doar in prima saptamana (rularea poate lipsi duminica)
    static final int EXPIRED_WINDOW_DAYS = 7;
    private static final DateTimeFormatter RO = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    private final AppUserRepository appUserRepository;
    private final EmailService emailService;

    @Value("${app.url:https://easyitp.vercel.app}")
    private String appUrl;

    public enum Stage {
        SOON,
        EXPIRED
    }

    public record RunResult(int sent, int failed) {
    }

    public RunResult runDaily(LocalDate today) {
        if (!emailService.isConfigured()) return new RunResult(0, 0);
        int sent = 0, failed = 0;
        for (AppUser station : appUserRepository.findByRoleOrderByIdAsc(Role.MANAGER)) {
            Stage stage = stage(station, today);
            if (stage == null) continue;
            try {
                emailService.send(station.getEmail(), subject(station, stage), html(station, stage));
                station.setPlanNotice(station.getPlanUntil() + ":" + stage);
                appUserRepository.save(station);
                sent++;
            } catch (DeliveryException e) {
                failed++;
                log.warn("Anuntul despre abonament pentru {} nu a plecat: {}", station.getId(), e.getMessage());
            }
        }
        if (sent + failed > 0) log.info("Anunturi abonament {}: {} trimise, {} esuate", today, sent, failed);
        return new RunResult(sent, failed);
    }

    // Ce anunt i se cuvine azi statiei (null = niciunul); EXPIRED inlocuieste SOON, nimic nu pleaca de doua ori
    static Stage stage(AppUser s, LocalDate today) {
        if (!s.isEnabled() || s.getPlan() == null || s.getPlan() == Plan.FREE || s.getPlanUntil() == null) return null;
        long daysLeft = ChronoUnit.DAYS.between(today, s.getPlanUntil());
        String prefix = s.getPlanUntil() + ":";
        String sent = s.getPlanNotice();
        if (daysLeft < 0 && daysLeft >= -EXPIRED_WINDOW_DAYS) {
            return (prefix + Stage.EXPIRED).equals(sent) ? null : Stage.EXPIRED;
        }
        if (daysLeft >= 0 && daysLeft <= SOON_DAYS) {
            return sent != null && sent.startsWith(prefix) ? null : Stage.SOON;
        }
        return null;
    }

    private static String subject(AppUser s, Stage stage) {
        boolean trial = Boolean.TRUE.equals(s.getPlanTrial());
        if (stage == Stage.SOON) {
            return trial ? "Easy ITP – perioada de probă se încheie pe " + s.getPlanUntil().format(RO)
                    : "Easy ITP – abonamentul expiră pe " + s.getPlanUntil().format(RO);
        }
        return trial ? "Easy ITP – perioada de probă s-a încheiat" : "Easy ITP – abonamentul a expirat";
    }

    private String html(AppUser s, Stage stage) {
        boolean trial = Boolean.TRUE.equals(s.getPlanTrial());
        String plan = s.getPlan().label();
        String until = s.getPlanUntil().format(RO);
        String link = AccountMail.stripSlash(appUrl) + "/account#abonament";
        String[] text;
        String title;
        if (stage == Stage.SOON) {
            title = trial ? "Perioada de probă se încheie curând" : "Abonamentul expiră curând";
            text = new String[]{
                    (trial ? "Perioada de probă " + plan : "Abonamentul " + plan) + " al stației "
                            + (s.getStationName() == null ? "" : s.getStationName()) + " este valabil până la " + until + " inclusiv.",
                    "După această dată stația trece pe pachetul Gratuit: datele rămân, dar SMS-urile automate și celelalte "
                            + "funcții din pachetele plătite se opresc.",
                    "Abonamentul nu se reînnoiește singur. Alegeți pachetul și plătiți din aplicație, în Contul meu → Abonament.",
            };
        } else {
            title = trial ? "Perioada de probă s-a încheiat" : "Abonamentul a expirat";
            text = new String[]{
                    (trial ? "Perioada de probă " + plan : "Abonamentul " + plan) + " s-a încheiat pe " + until
                            + ". Stația folosește acum pachetul Gratuit; toate datele sunt păstrate.",
                    "SMS-urile automate, rapoartele pentru patron și celelalte funcții plătite sunt oprite până alegeți un pachet.",
            };
        }
        return AccountMail.html(title, text, "Alege pachetul", link,
                "Pentru plata prin transfer bancar sau întrebări, scrieți-ne: datele de contact sunt pe easyitp.ro.");
    }
}
