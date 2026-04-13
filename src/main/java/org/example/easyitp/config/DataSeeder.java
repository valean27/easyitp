package org.example.easyitp.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.dto.CarMakeDTO;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.CarMakeRepository;
import org.example.easyitp.service.CarService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final CarMakeRepository carMakeRepository;
    private final CarService carService;

    @Override
    public void run(String... args) {
        if (!appUserRepository.existsByEmail("admin@itp.ro")) {
            AppUser admin = AppUser.builder()
                    .email("admin@itp.ro")
                    .password(passwordEncoder.encode("admin"))
                    .role(Role.ADMIN)
                    .build();
            appUserRepository.save(admin);
            log.info("Default admin seeded: admin@itp.ro");
        }

        if (carMakeRepository.count() == 0) {
            seedCarDictionary();
            log.info("Car dictionary seeded.");
        }
    }

    private void seedCarDictionary() {
        Map<String, List<String>> data = new LinkedHashMap<>();

        data.put("Dacia",         List.of("Logan", "Sandero", "Duster", "Jogger", "Spring", "Lodgy", "Pick Up", "1310", "Nova"));
        data.put("Volkswagen",    List.of("Golf", "Polo", "Passat", "Tiguan", "T-Roc", "Caddy", "Transporter", "Touareg", "Up", "Sharan", "Touran"));
        data.put("BMW",           List.of("Seria 1", "Seria 2", "Seria 3", "Seria 4", "Seria 5", "Seria 7", "X1", "X2", "X3", "X5", "X6", "Z4", "M3", "M5"));
        data.put("Mercedes-Benz", List.of("A-Class", "B-Class", "C-Class", "E-Class", "S-Class", "GLA", "GLB", "GLC", "GLE", "GLS", "Sprinter", "Vito", "Citan"));
        data.put("Audi",          List.of("A1", "A3", "A4", "A5", "A6", "A7", "A8", "Q2", "Q3", "Q5", "Q7", "TT", "RS3", "RS6"));
        data.put("Renault",       List.of("Clio", "Megane", "Laguna", "Captur", "Kadjar", "Kangoo", "Trafic", "Master", "Zoe", "Twingo", "Fluence", "Scenic"));
        data.put("Peugeot",       List.of("106", "107", "206", "207", "208", "301", "307", "308", "3008", "406", "407", "508", "5008", "Partner", "Expert", "Boxer"));
        data.put("Citroën",       List.of("C1", "C2", "C3", "C4", "C5", "C5 Aircross", "C-Elysée", "Berlingo", "Jumper", "Jumpy", "Dispatch"));
        data.put("Opel",          List.of("Astra", "Corsa", "Insignia", "Mokka", "Zafira", "Grandland", "Crossland", "Vivaro", "Meriva", "Vectra", "Omega", "Agila"));
        data.put("Ford",          List.of("Focus", "Fiesta", "Mondeo", "Kuga", "Transit", "Transit Connect", "Puma", "EcoSport", "Mustang", "Ranger", "Galaxy", "S-Max", "C-Max"));
        data.put("Toyota",        List.of("Corolla", "Yaris", "RAV4", "Land Cruiser", "Hilux", "Avensis", "Auris", "Prius", "C-HR", "Camry", "Verso", "Proace"));
        data.put("Skoda",         List.of("Octavia", "Fabia", "Superb", "Kodiaq", "Karoq", "Rapid", "Roomster", "Yeti", "Citigo", "Scala", "Kamiq"));
        data.put("Seat",          List.of("Ibiza", "Leon", "Ateca", "Arona", "Tarraco", "Alhambra", "Toledo", "Cordoba", "Altea", "Mii"));
        data.put("Fiat",          List.of("500", "Punto", "Tipo", "Panda", "Doblo", "Ducato", "Bravo", "Stilo", "Linea", "Scudo", "Fiorino", "Qubo", "Fullback"));
        data.put("Alfa Romeo",    List.of("147", "156", "159", "Giulia", "Giulietta", "Stelvio", "Mito", "Brera", "Spider", "GT"));
        data.put("Hyundai",       List.of("i10", "i20", "i30", "i40", "ix35", "Tucson", "Santa Fe", "Accent", "Elantra", "Ioniq", "Kona", "H-1"));
        data.put("Kia",           List.of("Picanto", "Rio", "Ceed", "ProCeed", "Stonic", "Sportage", "Sorento", "Niro", "Soul", "Carens", "Carnival"));
        data.put("Mazda",         List.of("Mazda2", "Mazda3", "Mazda6", "CX-3", "CX-5", "CX-30", "MX-5", "BT-50"));
        data.put("Nissan",        List.of("Micra", "Note", "Juke", "Qashqai", "X-Trail", "Pathfinder", "Navara", "Leaf", "Pulsar", "Terrano"));
        data.put("Honda",         List.of("Jazz", "Civic", "Accord", "CR-V", "HR-V", "FR-V", "Legend", "Element", "Stream", "Pilot"));
        data.put("Volvo",         List.of("S40", "S60", "S80", "S90", "V40", "V50", "V60", "V70", "V90", "XC40", "XC60", "XC70", "XC90"));
        data.put("Jeep",          List.of("Renegade", "Compass", "Cherokee", "Grand Cherokee", "Wrangler", "Avenger", "Commander"));
        data.put("Land Rover",    List.of("Defender", "Discovery", "Discovery Sport", "Freelander", "Range Rover", "Range Rover Evoque", "Range Rover Sport", "Range Rover Velar"));
        data.put("Mitsubishi",    List.of("Colt", "Lancer", "ASX", "Outlander", "Eclipse Cross", "L200", "Pajero", "Galant", "Space Star", "Carisma"));
        data.put("Suzuki",        List.of("Alto", "Swift", "Splash", "Celerio", "Ignis", "Baleno", "SX4", "Vitara", "Grand Vitara", "Jimny", "Liana", "Wagon R+"));
        data.put("Mini",          List.of("One", "Cooper", "Cooper S", "Countryman", "Clubman", "Paceman", "Cabrio", "Roadster"));
        data.put("Porsche",       List.of("911", "Boxster", "Cayman", "Cayenne", "Panamera", "Macan", "Taycan"));
        data.put("Tesla",         List.of("Model 3", "Model S", "Model X", "Model Y", "Cybertruck"));
        data.put("Cupra",         List.of("Leon", "Ateca", "Formentor", "Born", "Terramar"));
        data.put("Subaru",        List.of("Impreza", "Legacy", "Outback", "Forester", "XV", "Tribeca", "BRZ", "WRX"));

        data.forEach((makeName, models) -> {
            CarMakeDTO make = carService.findOrCreateMake(makeName);
            models.forEach(model -> carService.findOrCreateModel(model, make.getId()));
        });
    }
}

