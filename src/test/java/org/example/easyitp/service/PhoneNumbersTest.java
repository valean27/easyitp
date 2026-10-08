package org.example.easyitp.service;

import org.example.easyitp.config.FieldException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PhoneNumbersTest {

    @Test
    void romanianMobilesAreFormattedNationally() {
        assertThat(PhoneNumbers.requireMobile("0722123456")).isEqualTo("0722 123 456");
        assertThat(PhoneNumbers.requireMobile("+40 722 123 456")).isEqualTo("0722 123 456");
        assertThat(PhoneNumbers.requireMobile("0040722123456")).isEqualTo("0722 123 456");
        assertThat(PhoneNumbers.requireMobile("0722-123-456")).isEqualTo("0722 123 456");
    }

    @Test
    void foreignMobilesNeedTheCountryPrefix() {
        assertThat(PhoneNumbers.requireMobile("+49 1512 3456789")).isEqualTo("+49 1512 3456789");
        assertThat(PhoneNumbers.requireMobile("00393123456789")).startsWith("+39 ");
        assertThat(PhoneNumbers.requireMobile("+373 69 123 456")).startsWith("+373 ");
    }

    @Test
    void rejectsWrongNumbers() {
        // o cifra lipsa, una in plus, prefix inexistent, litere
        for (String bad : new String[]{"072212345", "07221234567", "0122123456", "abc", "+49 12", "+999 123456789"}) {
            assertThatThrownBy(() -> PhoneNumbers.requireMobile(bad)).as(bad).isInstanceOf(FieldException.class);
        }
        // fix romanesc: valid, dar nu primeste SMS
        assertThatThrownBy(() -> PhoneNumbers.requireMobile("0264 123 456")).hasMessageContaining("mobil");
        assertThat(PhoneNumbers.optionalValid("0264 123 456")).isEqualTo("0264 123 456");
        assertThat(PhoneNumbers.optionalValid("  ")).isNull();
    }

    @Test
    void smsStillUnderstandsTheStoredFormat() {
        assertThat(SmsSender.phoneDigits(PhoneNumbers.requireMobile("0722123456"))).isEqualTo("40722123456");
        assertThat(SmsSender.phoneDigits(PhoneNumbers.requireMobile("+49 1512 3456789"))).isEqualTo("4915123456789");
    }
}
