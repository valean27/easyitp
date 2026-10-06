package org.example.easyitp.entity;

// Pachetul aplicatiei (E1); ordinea conteaza: un pachet include tot ce au cele de dinaintea lui
public enum Plan {
    FREE("Gratuit"),
    PRO("Pro"),
    PREMIUM("Premium");

    private final String label;

    Plan(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public boolean includes(Plan other) {
        return compareTo(other) >= 0;
    }
}
