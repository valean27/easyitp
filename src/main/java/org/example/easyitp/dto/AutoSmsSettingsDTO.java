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
        long sentLast30Days) {
}
