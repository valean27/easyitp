package org.example.easyitp.service;

import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.CarMakeDTO;
import org.example.easyitp.dto.CarModelDTO;
import org.example.easyitp.entity.CarMake;
import org.example.easyitp.entity.CarModel;
import org.example.easyitp.repository.CarMakeRepository;
import org.example.easyitp.repository.CarModelRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CarService {

    private final CarMakeRepository carMakeRepository;
    private final CarModelRepository carModelRepository;

    private static final Duration PARSER_TTL = Duration.ofMinutes(10);
    private volatile CachedParser parserCache;

    public List<CarMakeDTO> getAllMakes() {
        return carMakeRepository.findAllByOrderByNameAsc()
                .stream()
                .map(m -> new CarMakeDTO(m.getId(), m.getName()))
                .collect(Collectors.toList());
    }

    @Transactional
    public CarMakeDTO findOrCreateMake(String name) {
        String trimmed = name.trim();
        CarMake make = carMakeRepository.findByNameIgnoreCase(trimmed)
                .orElseGet(() -> {
                    invalidateParser();
                    return carMakeRepository.save(CarMake.builder().name(trimmed).build());
                });
        return new CarMakeDTO(make.getId(), make.getName());
    }

    public List<CarModelDTO> getModelsForMake(Long makeId) {
        return carModelRepository.findAllByMakeIdOrderByNameAsc(makeId)
                .stream()
                .map(m -> new CarModelDTO(m.getId(), m.getName(), m.getMake().getId()))
                .collect(Collectors.toList());
    }

    @Transactional
    public CarModelDTO findOrCreateModel(String name, Long makeId) {
        String trimmed = name.trim();
        CarMake make = carMakeRepository.findById(makeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Make not found"));
        CarModel model = carModelRepository.findByNameIgnoreCaseAndMakeId(trimmed, makeId)
                .orElseGet(() -> {
                    invalidateParser();
                    return carModelRepository.save(CarModel.builder().name(trimmed).make(make).build());
                });
        return new CarModelDTO(model.getId(), model.getName(), makeId);
    }

    // Parserul de marca/model construit din dictionarul curent (inclusiv marcile fara modele). Pastrat in memorie
    // (scanarea si importul il folosesc des); refacut cand se adauga o marca/un model sau dupa PARSER_TTL.
    public VehicleNameParser vehicleNameParser() {
        CachedParser cached = parserCache;
        if (cached != null && cached.builtAt().plus(PARSER_TTL).isAfter(Instant.now())) return cached.parser();
        VehicleNameParser parser = buildParser();
        parserCache = new CachedParser(parser, Instant.now());
        return parser;
    }

    private void invalidateParser() {
        parserCache = null;
    }

    private record CachedParser(VehicleNameParser parser, Instant builtAt) {
    }

    private VehicleNameParser buildParser() {
        Map<String, List<String>> models = new LinkedHashMap<>();
        carMakeRepository.findAllByOrderByNameAsc().forEach(m -> models.put(m.getName(), new ArrayList<>()));
        for (CarModel model : carModelRepository.findAllWithMake()) {
            models.computeIfAbsent(model.getMake().getName(), k -> new ArrayList<>()).add(model.getName());
        }
        return new VehicleNameParser(models);
    }
}
