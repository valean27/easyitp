package org.example.easyitp.entity;

public enum Role {
    ADMIN,
    MANAGER,
    // Administratorul unei flote (firma client); vede doar masinile firmei lui
    FLEET,
    // Un inspector al statiei (legat de Inspector prin inspectorId); vede doar programarile lui
    INSPECTOR
}
