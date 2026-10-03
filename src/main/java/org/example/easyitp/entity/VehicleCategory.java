package org.example.easyitp.entity;

// Tipul vehiculului la programare; fiecare statie isi seteaza durata inspectiei pentru fiecare tip
public enum VehicleCategory {
    CAR("Autoturism", 20),
    FOUR_BY_FOUR("Autoturism 4x4 / SUV", 30),
    VAN("Autoutilitară (max. 3,5 t)", 45),
    MOTORCYCLE("Motocicletă", 20),
    TRAILER("Remorcă", 20);

    private final String label;
    private final int defaultMinutes;

    VehicleCategory(String label, int defaultMinutes) {
        this.label = label;
        this.defaultMinutes = defaultMinutes;
    }

    public String label() {
        return label;
    }

    public int defaultMinutes() {
        return defaultMinutes;
    }
}
