package org.example.easyitp.service;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;

// Limita simpla in memorie pentru programarile publice: cel mult MAX_PER_WINDOW pe IP pe ora.
// Suficient pentru o singura instanta pe Render; se reseteaza la repornire.
@Component
public class BookingRateLimiter {

    static final int MAX_PER_WINDOW = 5;
    private static final Duration WINDOW = Duration.ofHours(1);
    private static final int MAX_TRACKED_KEYS = 10_000;

    private final Map<String, Deque<Instant>> attempts = new HashMap<>();

    public synchronized boolean tryAcquire(String key) {
        Instant now = Instant.now();
        Instant cutoff = now.minus(WINDOW);
        if (attempts.size() > MAX_TRACKED_KEYS) {
            attempts.values().removeIf(q -> q.isEmpty() || q.peekLast().isBefore(cutoff));
        }
        Deque<Instant> queue = attempts.computeIfAbsent(key, k -> new ArrayDeque<>());
        while (!queue.isEmpty() && queue.peekFirst().isBefore(cutoff)) {
            queue.pollFirst();
        }
        if (queue.size() >= MAX_PER_WINDOW) return false;
        queue.addLast(now);
        return true;
    }
}
