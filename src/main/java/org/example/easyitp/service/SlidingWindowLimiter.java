package org.example.easyitp.service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;

// Cel mult `max` evenimente pe cheie (IP, email) intr-o fereastra glisanta; in memorie, se reseteaza la repornire.
// Suficient pentru o singura instanta pe Render.
public class SlidingWindowLimiter {

    private static final int MAX_TRACKED_KEYS = 10_000;

    private final int max;
    private final Duration window;
    private final Map<String, Deque<Instant>> events = new HashMap<>();

    public SlidingWindowLimiter(int max, Duration window) {
        this.max = max;
        this.window = window;
    }

    // Inregistreaza evenimentul daca mai e loc; false = limita atinsa
    public synchronized boolean tryAcquire(String key) {
        if (isBlocked(key)) return false;
        record(key);
        return true;
    }

    public synchronized boolean isBlocked(String key) {
        return recent(key).size() >= max;
    }

    public synchronized void record(String key) {
        recent(key).addLast(Instant.now());
    }

    public synchronized void reset(String key) {
        events.remove(key);
    }

    private Deque<Instant> recent(String key) {
        Instant cutoff = Instant.now().minus(window);
        if (events.size() > MAX_TRACKED_KEYS) {
            events.values().removeIf(q -> q.isEmpty() || q.peekLast().isBefore(cutoff));
        }
        Deque<Instant> queue = events.computeIfAbsent(key, k -> new ArrayDeque<>());
        while (!queue.isEmpty() && queue.peekFirst().isBefore(cutoff)) {
            queue.pollFirst();
        }
        return queue;
    }
}
