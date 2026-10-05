package org.example.easyitp.entity;

// Alte scadente ale masinii, pe langa ITP (C4)
public enum DeadlineKind {
    RCA("RCA", "RCA"),
    ROVINIETA("Rovinietă", "Rovinieta"),
    TAHOGRAF("Tahograf", "Verificarea tahografului");

    private final String label;
    // in SMS: fara diacritice, la inceputul propozitiei ("RCA pentru CJ01ABC expira pe ...")
    private final String smsLabel;

    DeadlineKind(String label, String smsLabel) {
        this.label = label;
        this.smsLabel = smsLabel;
    }

    public String label() {
        return label;
    }

    public String smsLabel() {
        return smsLabel;
    }
}
