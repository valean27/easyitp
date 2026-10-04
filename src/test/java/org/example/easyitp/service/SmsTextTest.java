package org.example.easyitp.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SmsTextTest {

    private static final SmsText.Data DATA = new SmsText.Data("Ion Popescu", "CJ 01 ABC", "Dacia Logan",
            LocalDate.of(2026, 11, 3), false, "ITP Ștefănești", null, "0722 111 222", null,
            "https://easyitp.vercel.app/stop/abc");

    @Test
    void defaultTextHasNoDiacriticsDropsMissingPartsAndEndsWithTheStopLink() {
        String text = SmsText.render(null, DATA);
        assertThat(text).isEqualTo("ITP Stefanesti: ITP-ul pentru CJ 01 ABC expira pe 03.11.2026. Programari la 0722 111 222."
                + "\nDezabonare: https://easyitp.vercel.app/stop/abc");
        assertThat(SmsText.segments(text)).isEqualTo(1);
    }

    @Test
    void customTemplateCanPlaceTheStopLinkItself() {
        String text = SmsText.render("Bună {nume}, ITP {numar} pe {data}. Stop: {stop}", DATA);
        assertThat(text).isEqualTo("Buna Ion Popescu, ITP CJ 01 ABC pe 03.11.2026. Stop: https://easyitp.vercel.app/stop/abc");
    }

    @Test
    void longTextsCountAsSeveralSms() {
        assertThat(SmsText.segments("a".repeat(160))).isEqualTo(1);
        assertThat(SmsText.segments("a".repeat(161))).isEqualTo(2);
        assertThat(SmsText.segments("a".repeat(307))).isEqualTo(3);
        assertThat(SmsText.plain("Mașină 🚗 „ok”")).isEqualTo("Masina  \"ok\"");
    }

    @Test
    void stagesAndWindows() {
        List<Integer> stages = List.of(30, 7);
        assertThat(AutoReminderService.stageFor(30, stages)).isEqualTo(30);
        assertThat(AutoReminderService.stageFor(26, stages)).isEqualTo(30);
        assertThat(AutoReminderService.stageFor(20, stages)).isNull();
        assertThat(AutoReminderService.stageFor(7, stages)).isEqualTo(7);
        assertThat(AutoReminderService.stageFor(2, stages)).isEqualTo(7);
        assertThat(AutoReminderService.stageFor(1, stages)).isNull();
        assertThat(AutoReminderService.stageFor(-1, stages)).isNull();
        assertThat(AutoReminderService.parseStages("7, 30,30, 99,abc")).containsExactly(30, 7);
    }

    @Test
    void onlyMobileNumbersAndSafeGatewayUrls() {
        assertThat(SmsSender.phoneDigits("0722 111 222")).isEqualTo("40722111222");
        assertThat(SmsSender.phoneDigits("+40 722-111-222")).isEqualTo("40722111222");
        assertThat(SmsSender.phoneDigits("0264 555 666")).isNull(); // fix: nu primeste SMS
        assertThat(SmsSender.phoneDigits("+49 151 2345 6789")).isEqualTo("4915123456789");
        assertThat(SmsSender.validSmsGateUrl("https://sms.statia-mea.ro/")).isEqualTo("https://sms.statia-mea.ro");
        assertThatThrownBy(() -> SmsSender.validSmsGateUrl("http://sms.statia-mea.ro")).isInstanceOf(DeliveryException.class);
        assertThatThrownBy(() -> SmsSender.validSmsGateUrl("https://10.0.0.5")).isInstanceOf(DeliveryException.class);
        assertThatThrownBy(() -> SmsSender.validSmsGateUrl("https://localhost")).isInstanceOf(DeliveryException.class);
    }
}
