package org.example.easyitp.dto;

import org.example.easyitp.entity.SmsProvider;

import java.util.List;

// Setarile remindere-lor SMS automate. Parolele sunt doar de scris: la citire vin goale, cu has*Password = true
// daca exista una salvata (gol la salvare = se pastreaza cea veche).
public record AutoSmsSettingsDTO(
        boolean enabled,
        SmsProvider provider,
        List<Integer> days,
        String template,
        String defaultTemplate,
        String smsGateUrl,
        String smsGateUsername,
        String smsGatePassword,
        boolean hasSmsGatePassword,
        String smslinkConnectionId,
        String smslinkPassword,
        boolean hasSmslinkPassword,
        long sentLast30Days,
        // SMS-uri pentru programari: confirmare la programarea online si reminder cu o zi inainte
        boolean apptConfirmSms,
        boolean apptReminderSms,
        // Inclus in abonament: contul platformei exista, pachetul statiei (SMS/luna) si cat a folosit luna aceasta
        boolean platformAvailable,
        int smsPlan,
        int smsUsedThisMonth,
        // SMS automat si pentru RCA / rovinieta / tahograf (cu 7 zile inainte)
        boolean deadlinesSms) {
}
