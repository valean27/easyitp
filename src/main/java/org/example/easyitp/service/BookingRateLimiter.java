package org.example.easyitp.service;

import org.springframework.stereotype.Component;

import java.time.Duration;

// Limita pentru programarile publice: cel mult MAX_PER_WINDOW pe IP pe ora
@Component
public class BookingRateLimiter {

    static final int MAX_PER_WINDOW = 5;

    private final SlidingWindowLimiter limiter = new SlidingWindowLimiter(MAX_PER_WINDOW, Duration.ofHours(1));

    public boolean tryAcquire(String key) {
        return limiter.tryAcquire(key);
    }
}
