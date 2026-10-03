package org.example.easyitp.service;

import org.springframework.stereotype.Component;

import java.time.Duration;

// Incercari de login gresite: pe email (ghicirea parolei unui cont) si pe IP (incercari pe multe conturi).
// Login-ul reusit sterge contorul emailului.
@Component
public class LoginRateLimiter {

    static final int MAX_FAILURES_PER_EMAIL = 10;
    static final int MAX_FAILURES_PER_IP = 30;
    private static final Duration WINDOW = Duration.ofMinutes(15);

    private final SlidingWindowLimiter byEmail = new SlidingWindowLimiter(MAX_FAILURES_PER_EMAIL, WINDOW);
    private final SlidingWindowLimiter byIp = new SlidingWindowLimiter(MAX_FAILURES_PER_IP, WINDOW);

    public boolean isBlocked(String ip, String email) {
        return byIp.isBlocked(ip) || byEmail.isBlocked(email);
    }

    public void recordFailure(String ip, String email) {
        byIp.record(ip);
        byEmail.record(email);
    }

    public void recordSuccess(String email) {
        byEmail.reset(email);
    }
}
