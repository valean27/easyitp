package org.example.easyitp.controller;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.example.easyitp.dto.CarMakeDTO;
import org.example.easyitp.dto.CarModelDTO;
import org.example.easyitp.service.CarService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cars")
@RequiredArgsConstructor
public class CarController {

    private final CarService carService;

    @GetMapping("/makes")
    public List<CarMakeDTO> getMakes() {
        return carService.getAllMakes();
    }

    @PostMapping("/makes")
    public CarMakeDTO createMake(@RequestBody NameRequest body) {
        return carService.findOrCreateMake(body.getName());
    }

    @GetMapping("/models")
    public List<CarModelDTO> getModels(@RequestParam Long makeId) {
        return carService.getModelsForMake(makeId);
    }

    @PostMapping("/models")
    public CarModelDTO createModel(@RequestBody ModelRequest body) {
        return carService.findOrCreateModel(body.getName(), body.getMakeId());
    }

    @Data
    static class NameRequest {
        private String name;
    }

    @Data
    static class ModelRequest {
        private String name;
        private Long makeId;
    }
}
