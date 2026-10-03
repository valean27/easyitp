package org.example.easyitp.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.util.TimeZone;

// Serverul (Render) ruleaza in UTC, dar "azi", ora programarilor si expirarea ITP sunt in ora Romaniei
@Configuration
@Slf4j
public class TimeZoneConfig {

    @Value("${app.timezone:Europe/Bucharest}")
    private String timezone;

    @PostConstruct
    void setDefaultTimeZone() {
        TimeZone.setDefault(TimeZone.getTimeZone(timezone));
        log.info("Fus orar implicit: {}", timezone);
    }
}
