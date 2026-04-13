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

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CarService {

    private final CarMakeRepository carMakeRepository;
    private final CarModelRepository carModelRepository;

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
                .orElseGet(() -> carMakeRepository.save(
                        CarMake.builder().name(trimmed).build()));
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
                .orElseGet(() -> carModelRepository.save(
                        CarModel.builder().name(trimmed).make(make).build()));
        return new CarModelDTO(model.getId(), model.getName(), makeId);
    }
}
