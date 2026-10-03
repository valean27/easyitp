package org.example.easyitp.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.CarMake;
import org.example.easyitp.entity.CarModel;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.CarMakeRepository;
import org.example.easyitp.repository.CarModelRepository;
import org.example.easyitp.service.VehicleNameParser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final CarMakeRepository carMakeRepository;
    private final CarModelRepository carModelRepository;

    @Value("${admin.email:admin@itp.ro}")
    private String adminEmail;

    // Daca e setat (ADMIN_PASSWORD), parola adminului e sincronizata la fiecare pornire
    @Value("${admin.password:}")
    private String adminPassword;

    @Override
    public void run(String... args) {
        seedAdmin();

        syncCarDictionary();
    }

    private void seedAdmin() {
        AppUser admin = appUserRepository.findByEmail(adminEmail).orElse(null);
        if (admin == null) {
            if (adminPassword.isBlank()) {
                throw new IllegalStateException("ADMIN_PASSWORD lipseste: contul de admin nu poate fi creat fara parola.");
            }
            appUserRepository.save(AppUser.builder()
                    .email(adminEmail)
                    .password(passwordEncoder.encode(adminPassword))
                    .role(Role.ADMIN)
                    .build());
            log.info("Default admin seeded: {}", adminEmail);
        } else if (!adminPassword.isBlank() && !passwordEncoder.matches(adminPassword, admin.getPassword())) {
            admin.setPassword(passwordEncoder.encode(adminPassword));
            appUserRepository.save(admin);
            log.info("Parola adminului actualizata din ADMIN_PASSWORD.");
        }
    }

    // Adauga marcile si modelele din car-dictionary.txt care lipsesc din baza de date (comparate fara
    // majuscule, diacritice, spatii si cratime); ce exista deja, inclusiv ce au adaugat managerii, ramane neatins
    private void syncCarDictionary() {
        Map<String, CarMake> makes = new HashMap<>();
        carMakeRepository.findAll().forEach(m -> makes.putIfAbsent(VehicleNameParser.key(m.getName()), m));
        Set<String> models = new HashSet<>();
        carModelRepository.findAllWithMake().forEach(m -> models.add(m.getMake().getId() + "|" + VehicleNameParser.key(m.getName())));

        int addedMakes = 0;
        List<CarModel> newModels = new ArrayList<>();
        for (Map.Entry<String, List<String>> entry : CarDictionary.load().entrySet()) {
            CarMake make = makes.get(VehicleNameParser.key(entry.getKey()));
            if (make == null) {
                make = carMakeRepository.save(CarMake.builder().name(entry.getKey()).build());
                makes.put(VehicleNameParser.key(entry.getKey()), make);
                addedMakes++;
            }
            for (String model : entry.getValue()) {
                if (models.add(make.getId() + "|" + VehicleNameParser.key(model))) {
                    newModels.add(CarModel.builder().name(model).make(make).build());
                }
            }
        }
        carModelRepository.saveAll(newModels);
        if (addedMakes > 0 || !newModels.isEmpty()) {
            log.info("Car dictionary synced: {} makes and {} models added.", addedMakes, newModels.size());
        }
    }
}

