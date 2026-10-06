package org.example.easyitp.service;

import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Plan;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class PlansTest {

    private final LocalDate today = LocalDate.of(2026, 10, 6);

    @Test
    void effectivePlanFollowsTheLastPaidDay() {
        assertThat(Plans.effective(AppUser.builder().build(), today)).isEqualTo(Plan.PREMIUM);
        assertThat(Plans.effective(AppUser.builder().plan(Plan.PRO).planUntil(today).build(), today)).isEqualTo(Plan.PRO);
        assertThat(Plans.effective(AppUser.builder().plan(Plan.PRO).planUntil(today.minusDays(1)).build(), today)).isEqualTo(Plan.FREE);
        assertThat(Plans.effective(AppUser.builder().plan(Plan.PRO).build(), today)).isEqualTo(Plan.PRO);
    }

    @Test
    void amountsIncludeVatAndTheYearlyDiscount() {
        assertThat(Plans.amount(Plan.PRO, 0, 1)).isEqualByComparingTo("71.39");
        assertThat(Plans.amount(Plan.PREMIUM, 600, 1)).isEqualByComparingTo("384.78");
        // 12 luni la pret de 10
        assertThat(Plans.amount(Plan.PRO, 0, 12)).isEqualByComparingTo("713.90");
    }

    @Test
    void renewingExtendsAndChangingPlanConvertsTheRemainingDays() {
        AppUser trial = AppUser.builder().plan(Plan.PREMIUM).planUntil(today.plusDays(10)).planTrial(true).build();
        // in proba: perioada platita incepe dupa ultima zi de proba
        assertThat(BillingService.applyPaid(trial, Plan.PRO, 0, 1, today)).isEqualTo(today.plusDays(10).plusMonths(1));
        assertThat(trial.getPlanTrial()).isFalse();

        AppUser pro = AppUser.builder().plan(Plan.PRO).smsPlan(0).planUntil(today.plusDays(20)).planTrial(false).build();
        // acelasi pachet: dupa ultima zi platita
        assertThat(BillingService.applyPaid(pro, Plan.PRO, 0, 1, today)).isEqualTo(today.plusDays(20).plusMonths(1));

        AppUser pro2 = AppUser.builder().plan(Plan.PRO).smsPlan(0).planUntil(today.plusDays(30)).planTrial(false).build();
        // trecere pe Premium: 30 de zile Pro (59) = 17 zile Premium (99)
        assertThat(BillingService.applyPaid(pro2, Plan.PREMIUM, 0, 1, today)).isEqualTo(today.plusMonths(1).plusDays(17));
        assertThat(pro2.getPlan()).isEqualTo(Plan.PREMIUM);

        AppUser expired = AppUser.builder().plan(Plan.PRO).planUntil(today.minusDays(3)).planTrial(false).build();
        assertThat(BillingService.applyPaid(expired, Plan.PRO, 0, 12, today)).isEqualTo(today.plusMonths(12));
    }
}
