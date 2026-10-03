package org.example.easyitp.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PlateUtilsTest {

    @Test
    void ignoresSpacesDashesAndCase() {
        assertThat(PlateUtils.normalize("cj 01-abc")).isEqualTo("CJ01ABC");
        assertThat(PlateUtils.normalize("CJ01ABC")).isEqualTo("CJ01ABC");
        assertThat(PlateUtils.normalize(" B 123 XYZ ")).isEqualTo("B123XYZ");
    }

    @Test
    void nullBecomesEmpty() {
        assertThat(PlateUtils.normalize(null)).isEmpty();
    }
}
