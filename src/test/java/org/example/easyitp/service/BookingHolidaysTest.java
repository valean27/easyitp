package org.example.easyitp.service;

import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.entity.VehicleCategory;
import org.example.easyitp.repository.AppUserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

// Sarbatorile legale opresc programarea online, cu „acum” fixat (nu depinde de ziua in care ruleaza testul)
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class BookingHolidaysTest {

    @Autowired private BookingService bookingService;
    @Autowired private AppUserRepository users;

    @Test
    void legalHolidaysAreClosedUnlessTheStationWorks() {
        AppUser station = users.save(AppUser.builder().email("sarbatori@itp.ro").password("x").role(Role.MANAGER)
                .stationName("ITP Sarbatori").bookingEnabled(true).bookingSlug("sarbatori").bookingDays("1,2,3,4,5,6,7").build());
        LocalDate nationalDay = LocalDate.of(2026, 12, 1);
        LocalDateTime now = LocalDateTime.of(2026, 11, 25, 8, 0);

        assertThat(bookingService.availableSlots(station, nationalDay, VehicleCategory.CAR, now)).isEmpty();
        assertThat(bookingService.availableSlots(station, nationalDay.plusDays(1), VehicleCategory.CAR, now)).isNotEmpty();
        assertThat(bookingService.closedDays(station, nationalDay, nationalDay))
                .singleElement().satisfies(d -> {
                    assertThat(d.name()).isEqualTo("Ziua Națională");
                    assertThat(d.holiday()).isTrue();
                });

        station.setBookingHolidaysClosed(false);
        assertThat(bookingService.availableSlots(station, nationalDay, VehicleCategory.CAR, now)).isNotEmpty();
        assertThat(bookingService.closedDays(station, nationalDay, nationalDay)).isEmpty();
    }
}
