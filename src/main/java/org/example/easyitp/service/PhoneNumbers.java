package org.example.easyitp.service;

import com.google.i18n.phonenumbers.NumberParseException;
import com.google.i18n.phonenumbers.PhoneNumberUtil;
import com.google.i18n.phonenumbers.PhoneNumberUtil.PhoneNumberFormat;
import com.google.i18n.phonenumbers.PhoneNumberUtil.PhoneNumberType;
import com.google.i18n.phonenumbers.Phonenumber.PhoneNumber;
import org.example.easyitp.config.FieldException;

import java.util.Optional;

// Numerele de telefon, cu regulile fiecarei tari (libphonenumber de la Google): fara prefix = numar romanesc,
// altfel cu prefixul tarii (+49 / 0049 ...). Numerele romanesti se pastreaza "0722 123 456", celelalte "+49 1512 3456789".
public final class PhoneNumbers {

    private static final PhoneNumberUtil UTIL = PhoneNumberUtil.getInstance();
    private static final String DEFAULT_REGION = "RO";

    public record Checked(String formatted, String region, boolean mobile) {
    }

    private PhoneNumbers() {
    }

    // Numarul, daca e valid in tara lui; gol altfel
    public static Optional<Checked> check(String raw) {
        if (raw == null || raw.isBlank()) return Optional.empty();
        String input = raw.trim();
        if (input.startsWith("00")) input = "+" + input.substring(2);
        try {
            PhoneNumber number = UTIL.parse(input, DEFAULT_REGION);
            if (!UTIL.isValidNumber(number)) return Optional.empty();
            String region = UTIL.getRegionCodeForNumber(number);
            PhoneNumberType type = UTIL.getNumberType(number);
            boolean mobile = type == PhoneNumberType.MOBILE || type == PhoneNumberType.FIXED_LINE_OR_MOBILE;
            String formatted = UTIL.format(number, DEFAULT_REGION.equals(region) ? PhoneNumberFormat.NATIONAL : PhoneNumberFormat.INTERNATIONAL);
            return Optional.of(new Checked(formatted, region, mobile));
        } catch (NumberParseException e) {
            return Optional.empty();
        }
    }

    // Programarea online: numar valid si de mobil (confirmarea si reminderul pleaca prin SMS)
    public static String requireMobile(String raw) {
        if (raw == null || raw.isBlank()) throw new FieldException("phone", "Introduceți numărul de telefon.");
        Checked c = check(raw).orElseThrow(() -> new FieldException("phone", invalidMessage(raw)));
        if (!c.mobile()) throw new FieldException("phone", "Introduceți un număr de mobil: confirmarea programării vine prin SMS.");
        return c.formatted();
    }

    // Programarea facuta de statie: optional, dar daca e scris trebuie sa fie valid (fix sau mobil)
    public static String optionalValid(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return check(raw).map(Checked::formatted).orElseThrow(() -> new FieldException("phone", invalidMessage(raw)));
    }

    private static String invalidMessage(String raw) {
        String t = raw.trim();
        boolean foreign = t.startsWith("+") || t.startsWith("00");
        return foreign
                ? "Numărul de telefon nu este valid pentru țara lui. Verificați prefixul și cifrele."
                : "Numărul de telefon nu este valid. Verificați cifrele (ex. 0722 123 456); pentru alte țări scrieți-l cu prefixul țării (ex. +49 ...).";
    }
}
