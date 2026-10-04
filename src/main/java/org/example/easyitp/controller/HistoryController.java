package org.example.easyitp.controller;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.security.CurrentUser;
import org.example.easyitp.service.HistoryService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

// Istoricul modificarilor statiei si anularea stergerilor
@RestController
@RequestMapping("/api/history")
@RequiredArgsConstructor
public class HistoryController {

    // Raspunsul unei stergeri poarta id-ul intrarii din istoric, ca interfata sa poata oferi "Anuleaza"
    public static final String EVENT_HEADER = "X-Audit-Event";

    private final HistoryService historyService;
    private final CurrentUser currentUser;

    @GetMapping
    public HistoryService.HistoryPageDTO list(@RequestParam(defaultValue = "all") String filter,
                                              @RequestParam(defaultValue = "0") int page,
                                              @RequestParam(defaultValue = "50") int size) {
        return historyService.list(currentUser.get(), filter, page, size);
    }

    @PostMapping("/{id}/undo")
    public Map<String, String> undo(@PathVariable Long id) {
        return Map.of("message", historyService.undo(currentUser.get(), id));
    }
}
