package org.example.easyitp.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ClientKeysTest {

    @Test
    void phoneKeyIgnoresFormattingAndCountryPrefix() {
        assertThat(ClientKeys.phoneKey("0722 111 222")).isEqualTo("722111222");
        assertThat(ClientKeys.phoneKey("+40 722-111-222")).isEqualTo("722111222");
        assertThat(ClientKeys.phoneKey("0040722111222")).isEqualTo("722111222");
        assertThat(ClientKeys.phoneKey("  ")).isNull();
        assertThat(ClientKeys.phoneKey(null)).isNull();
    }

    @Test
    void namesMatchWithoutDiacriticsCaseOrExtraSpaces() {
        assertThat(ClientKeys.sameName("Ștefan  Ionescu", "stefan ionescu")).isTrue();
        assertThat(ClientKeys.sameName("Ana Pop", "Ana Popa")).isFalse();
    }
}
