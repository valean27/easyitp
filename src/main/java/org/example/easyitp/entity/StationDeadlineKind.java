package org.example.easyitp.entity;

// Termenele statiei (D1)
public enum StationDeadlineKind {
    AUTORIZATIE_RAR("Autorizația RAR", 60),
    METROLOGIE("Verificare metrologică", 30),
    ATESTAT_INSPECTOR("Atestat inspector", 45),
    ALTUL("Alt termen", 30);

    private final String label;
    // cu cate zile inainte apare alerta (autorizatia se reinnoieste greu, atestatul cere curs)
    private final int warnDays;

    StationDeadlineKind(String label, int warnDays) {
        this.label = label;
        this.warnDays = warnDays;
    }

    public String label() {
        return label;
    }

    public int warnDays() {
        return warnDays;
    }
}
