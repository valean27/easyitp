package org.example.easyitp.service;

import org.example.easyitp.config.CarDictionary;
import org.example.easyitp.service.VehicleNameParser.ParsedVehicle;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class VehicleNameParserTest {

    private final VehicleNameParser parser = new VehicleNameParser(Map.ofEntries(
            Map.entry("Dacia", List.of("Logan", "Duster", "Sandero")),
            Map.entry("Volkswagen", List.of("Passat", "Tiguan", "Polo", "Phaeton")),
            Map.entry("Renault", List.of("Megane", "Scenic")),
            Map.entry("Hyundai", List.of("Santa Fe", "i20")),
            Map.entry("Mercedes-Benz", List.of("C-Class")),
            Map.entry("Citroën", List.of("C4")),
            Map.entry("Ford", List.of("Puma", "Focus")),
            Map.entry("Alfa Romeo", List.of("Giulia")),
            Map.entry("Toyota", List.of("Aygo", "Yaris")),
            Map.entry("Audi", List.of("A4")),
            Map.entry("BMW", List.of("X3")),
            Map.entry("Nissan", List.of("Qashqai")),
            Map.entry("Fiat", List.of("Punto")),
            Map.entry("Kia", List.of("Ceed"))));

    @Test
    void splitsMakeAndModelUsingTheDictionary() {
        assertThat(parser.parse("dacia logan")).isEqualTo(new ParsedVehicle("Dacia", "Logan", null));
        assertThat(parser.parse("Dacia SANDERO")).isEqualTo(new ParsedVehicle("Dacia", "Sandero", null));
        assertThat(parser.parse("citroen c4")).isEqualTo(new ParsedVehicle("Citroën", "C4", null));
        assertThat(parser.parse("alfa romeo giulia")).isEqualTo(new ParsedVehicle("Alfa Romeo", "Giulia", null));
    }

    @Test
    void fixesCommonTyposAndAbbreviations() {
        assertThat(parser.parse("renualt megane")).isEqualTo(new ParsedVehicle("Renault", "Megane", null));
        assertThat(parser.parse("dacie logan")).isEqualTo(new ParsedVehicle("Dacia", "Logan", null));
        assertThat(parser.parse("vw cc")).isEqualTo(new ParsedVehicle("Volkswagen", "CC", null));
        assertThat(parser.parse("vs passat")).isEqualTo(new ParsedVehicle("Volkswagen", "Passat", null));
        assertThat(parser.parse("VW")).isEqualTo(new ParsedVehicle("Volkswagen", null, null));
        assertThat(parser.parse("mercedes")).isEqualTo(new ParsedVehicle("Mercedes-Benz", null, null));
        assertThat(parser.parse("hiunday santa fee")).isEqualTo(new ParsedVehicle("Hyundai", "Santa Fee", null));
    }

    @Test
    void toleratesMisspelledMakes() {
        assertThat(parser.parse("Rebualt")).isEqualTo(new ParsedVehicle("Renault", null, null));
        assertThat(parser.parse("renaut clio")).isEqualTo(new ParsedVehicle("Renault", "Clio", null));
        assertThat(parser.parse("meredes")).isEqualTo(new ParsedVehicle("Mercedes-Benz", null, null));
        assertThat(parser.parse("nissa qua")).isEqualTo(new ParsedVehicle("Nissan", "Qua", null));
        assertThat(parser.parse("vv passat")).isEqualTo(new ParsedVehicle("Volkswagen", "Passat", null));
        // modelele cunoscute nu sunt confundate cu marci asemanatoare
        assertThat(parser.parse("fiesta").brand()).isNotEqualTo("Fiat");
        assertThat(parser.parse("polo")).isEqualTo(new ParsedVehicle("Volkswagen", "Polo", null));
    }

    @Test
    void splitsMakeGluedToModel() {
        assertThat(parser.parse("BMW320")).isEqualTo(new ParsedVehicle("BMW", "320", null));
        assertThat(parser.parse("AUDIA4")).isEqualTo(new ParsedVehicle("Audi", "A4", null));
        assertThat(parser.parse("Toyotaaygo")).isEqualTo(new ParsedVehicle("Toyota", "Aygo", null));
    }

    @Test
    void infersMakeFromModelOnlyAndFindsMakeAnywhere() {
        assertThat(parser.parse("passat")).isEqualTo(new ParsedVehicle("Volkswagen", "Passat", null));
        assertThat(parser.parse("POLO")).isEqualTo(new ParsedVehicle("Volkswagen", "Polo", null));
        assertThat(parser.parse("dokker dacia")).isEqualTo(new ParsedVehicle("Dacia", "Dokker", null));
    }

    @Test
    void extractsYearAndKeepsUnknownNames() {
        assertThat(parser.parse("Ford Puma 2021")).isEqualTo(new ParsedVehicle("Ford", "Puma", 2021));
        assertThat(parser.parse("remorca")).isEqualTo(new ParsedVehicle("Remorca", null, null));
        assertThat(parser.parse("lancia")).isEqualTo(new ParsedVehicle("Lancia", null, null));
        assertThat(parser.parse("")).isEqualTo(new ParsedVehicle("Necunoscut", null, null));
    }

    @Test
    void worksWithTheFullDictionary() {
        VehicleNameParser full = new VehicleNameParser(CarDictionary.load());
        assertThat(full.parse("cherry omoda 5")).isEqualTo(new ParsedVehicle("Chery", "Omoda 5", null));
        assertThat(full.parse("OMODA 5 2024")).isEqualTo(new ParsedVehicle("Omoda", "5", 2024));
        assertThat(full.parse("byd seal u")).isEqualTo(new ParsedVehicle("BYD", "Seal U", null));
        assertThat(full.parse("ssang yong tivoli")).isEqualTo(new ParsedVehicle("SsangYong", "Tivoli", null));
        assertThat(full.parse("land rover defender")).isEqualTo(new ParsedVehicle("Land Rover", "Defender", null));
        assertThat(full.parse("alfa 159")).isEqualTo(new ParsedVehicle("Alfa Romeo", "159", null));
        assertThat(full.parse("lancia ypsilon")).isEqualTo(new ParsedVehicle("Lancia", "Ypsilon", null));
        assertThat(full.parse("vw lt")).isEqualTo(new ParsedVehicle("Volkswagen", "LT", null));
        assertThat(full.parse("lexus rx")).isEqualTo(new ParsedVehicle("Lexus", "RX", null));
        assertThat(full.parse("mercedes glc")).isEqualTo(new ParsedVehicle("Mercedes-Benz", "GLC", null));
        assertThat(full.parse("bmw x5")).isEqualTo(new ParsedVehicle("BMW", "X5", null));
        // modelul singur, fara marca
        assertThat(full.parse("passat")).isEqualTo(new ParsedVehicle("Volkswagen", "Passat", null));
        assertThat(full.parse("qashqai")).isEqualTo(new ParsedVehicle("Nissan", "Qashqai", null));
        assertThat(full.parse("500")).isEqualTo(new ParsedVehicle("Fiat", "500", null));
        assertThat(full.parse("sportage")).isEqualTo(new ParsedVehicle("Kia", "Sportage", null));
        assertThat(full.parse("fiesta")).isEqualTo(new ParsedVehicle("Ford", "Fiesta", null));
        assertThat(full.parse("remorca")).isEqualTo(new ParsedVehicle("Remorca", null, null));
    }

    @Test
    void fullDictionaryHasNoDuplicateMakesOrModels() {
        var data = CarDictionary.load();
        assertThat(data.keySet().stream().map(VehicleNameParser::key)).doesNotHaveDuplicates();
        data.forEach((make, models) -> assertThat(models.stream().map(VehicleNameParser::key))
                .as(make).doesNotHaveDuplicates());
    }
}
