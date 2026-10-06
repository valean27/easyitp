package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.entity.JobRun;
import org.example.easyitp.repository.JobRunRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;

// Rularea de dimineata: rezumatul zilnic, SMS-urile automate, reminderele pentru programari, cererile de recenzie,
// anunturile despre abonament, nota Google si curatenia. Porneste din ceasul aplicatiei (DailyJobScheduler, 07:00 ora
// Romaniei) sau din apelul extern (GitHub Actions, rezerva). Ziua se rezerva atomic in baza de date (job_runs), deci
// oricate declansari ar veni, ruleaza o singura data pe zi.
@Service
@RequiredArgsConstructor
@Slf4j
public class DailyJobService {

    static final String NAME = "daily";

    private final DigestService digestService;
    private final HistoryService historyService;
    private final AutoReminderService autoReminderService;
    private final AppointmentSmsService appointmentSmsService;
    private final ReviewRequestService reviewRequestService;
    private final GooglePlacesService googlePlacesService;
    private final PlanNoticeService planNoticeService;
    private final AccountEmailService accountEmailService;
    private final AccountDeletionService accountDeletionService;
    private final JobRunRepository jobRunRepository;
    private final TransactionTemplate transactionTemplate;

    // null = a rulat deja azi
    public synchronized DigestService.Result runOnce(LocalDate today) {
        if (!claim(today)) return null;
        log.info("Rularea zilnica pentru {} a pornit", today);
        DigestService.Result result = digestService.sendDailyDigests(today);
        // O eroare la un pas nu le opreste pe celelalte si nu strica rezumatul deja trimis
        step("SMS-urile automate", () -> autoReminderService.runDaily(today));
        step("Reminderele pentru programari", () -> appointmentSmsService.runDayBefore(today));
        step("Cererile de recenzie", () -> reviewRequestService.runDaily(today));
        step("Anunturile despre abonament", () -> planNoticeService.runDaily(today));
        step("Notele Google", () -> googlePlacesService.refreshAll(java.time.LocalDateTime.now()));
        step("Curatarea istoricului", historyService::purgeOld);
        step("Curatarea linkurilor expirate", accountEmailService::purgeExpired);
        step("Stergerea conturilor cerute", () -> accountDeletionService.purgeDue(java.time.LocalDateTime.now()));
        return result;
    }

    // Rezerva ziua: true doar pentru prima declansare din ziua respectiva
    boolean claim(LocalDate today) {
        try {
            Boolean claimed = transactionTemplate.execute(status -> {
                JobRun run = jobRunRepository.lockByName(NAME).orElse(null);
                if (run == null) {
                    jobRunRepository.saveAndFlush(JobRun.builder().name(NAME).lastDate(today).build());
                    return true;
                }
                if (run.getLastDate() != null && !run.getLastDate().isBefore(today)) return false;
                run.setLastDate(today);
                jobRunRepository.save(run);
                return true;
            });
            return Boolean.TRUE.equals(claimed);
        } catch (DataIntegrityViolationException e) {
            // alta declansare a creat randul in acelasi moment: ea ruleaza
            return false;
        }
    }

    private static void step(String what, Runnable action) {
        try {
            action.run();
        } catch (RuntimeException e) {
            log.error("{} au esuat", what, e);
        }
    }
}
