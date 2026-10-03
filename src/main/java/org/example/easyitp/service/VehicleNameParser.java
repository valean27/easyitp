package org.example.easyitp.service;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

// Desparte textul liber din CSV ("dacia logan", "renualt megane", "passat", "Ford Puma 2021")
// in marca, model si an, folosind dictionarul de marci/modele si cateva greseli frecvente.
public class VehicleNameParser {

    public record ParsedVehicle(String brand, String model, Integer year) {
    }

    // Prescurtari si greseli de scriere intalnite in fisierele statiilor
    private static final Map<String, String> ALIASES = Map.ofEntries(
            Map.entry("vw", "volkswagen"), Map.entry("vs", "volkswagen"), Map.entry("vv", "volkswagen"), Map.entry("volkswagon", "volkswagen"),
            Map.entry("mercedes", "mercedes-benz"), Map.entry("mercedesbenz", "mercedes-benz"), Map.entry("mb", "mercedes-benz"),
            Map.entry("renualt", "renault"), Map.entry("renual", "renault"), Map.entry("reanult", "renault"), Map.entry("renaul", "renault"),
            Map.entry("dacie", "dacia"),
            Map.entry("hiunday", "hyundai"), Map.entry("hyunday", "hyundai"), Map.entry("hiundai", "hyundai"), Map.entry("huyndai", "hyundai"),
            Map.entry("peogeot", "peugeot"), Map.entry("pegeot", "peugeot"),
            Map.entry("scoda", "skoda"), Map.entry("citroien", "citroen"),
            Map.entry("bmv", "bmw"), Map.entry("toyta", "toyota"), Map.entry("opell", "opel"),
            Map.entry("alfa", "alfa romeo"), Map.entry("cherry", "chery"), Map.entry("kgm", "ssangyong"), Map.entry("chevy", "chevrolet"),
            Map.entry("porche", "porsche"), Map.entry("wolkswagen", "volkswagen"), Map.entry("folkswagen", "volkswagen"),
            Map.entry("mitsubisi", "mitsubishi"), Map.entry("mitsubishy", "mitsubishi"), Map.entry("landrover", "land rover"),
            Map.entry("rangerover", "land rover"), Map.entry("lexsus", "lexus"));

    private static final Set<String> MULTI_WORD_PREFIXES = Set.of("alfa", "land", "mercedes", "ssang", "great", "aston", "rolls");

    // cheie normalizata -> nume canonic din dictionar
    private final Map<String, String> makes = new HashMap<>();
    // marca canonica -> (model normalizat -> nume canonic)
    private final Map<String, Map<String, String>> modelsByMake = new HashMap<>();
    // model normalizat -> marcile care il au
    private final Map<String, List<String>> makesByModel = new HashMap<>();

    // modelsByMakeName: marca -> modelele ei (din CarMake/CarModel)
    public VehicleNameParser(Map<String, List<String>> modelsByMakeName) {
        modelsByMakeName.forEach((make, models) -> {
            makes.put(key(make), make);
            Map<String, String> index = new HashMap<>();
            for (String model : models) {
                index.put(key(model), model);
                makesByModel.computeIfAbsent(key(model), k -> new ArrayList<>()).add(make);
            }
            modelsByMake.put(make, index);
        });
    }

    public ParsedVehicle parse(String raw) {
        if (raw == null || raw.isBlank()) return new ParsedVehicle("Necunoscut", null, null);

        List<String> tokens = new ArrayList<>(Arrays.asList(raw.trim().split("\\s+")));
        Integer year = null;
        for (int i = tokens.size() - 1; i >= 0; i--) {
            if (tokens.get(i).matches("(19|20)\\d{2}")) {
                year = Integer.valueOf(tokens.remove(i));
                break;
            }
        }
        if (tokens.isEmpty()) return new ParsedVehicle("Necunoscut", null, year);

        // 1. Marca exacta sau prescurtata, oriunde in text ("dokker dacia"), pe unul sau doua cuvinte ("alfa romeo")
        for (int i = 0; i < tokens.size(); i++) {
            String make = null;
            int length = 1;
            if (i + 1 < tokens.size() && MULTI_WORD_PREFIXES.contains(key(tokens.get(i)))) {
                make = findMake(tokens.get(i) + "-" + tokens.get(i + 1));
                if (make == null) make = findMake(tokens.get(i) + " " + tokens.get(i + 1));
                if (make != null) length = 2;
            }
            if (make == null) make = findMake(tokens.get(i));
            if (make != null) return withModel(make, tokens, i, length, null, year);

            // Marca lipita de model: "bmw320", "audia4", "toyotaaygo"
            String token = key(tokens.get(i));
            for (Map.Entry<String, String> m : makes.entrySet()) {
                String rest = token.length() > m.getKey().length() ? token.substring(m.getKey().length()) : "";
                if (m.getKey().length() >= 3 && token.startsWith(m.getKey()) && rest.matches("[a-z0-9]{1,6}")) {
                    return withModel(m.getValue(), tokens, i, 1, rest, year);
                }
            }
        }

        // 2. Doar modelul ("passat", "tiguan"): marca se deduce daca modelul e al unei singure marci
        String whole = String.join(" ", tokens);
        List<String> candidates = makesByModel.getOrDefault(key(whole), List.of());
        if (candidates.size() == 1) {
            String make = candidates.get(0);
            return new ParsedVehicle(make, modelsByMake.get(make).get(key(whole)), year);
        }

        // 3. Marca scrisa gresit ("rebualt", "meredes", "nissa"); abia acum, ca un model sa nu fie luat drept marca
        for (int i = 0; i < tokens.size(); i++) {
            String make = findMakeFuzzy(tokens.get(i));
            if (make != null) return withModel(make, tokens, i, 1, null, year);
        }
        return new ParsedVehicle(titleCase(whole), null, year);
    }

    // Marca gasita la pozitia i (pe "length" cuvinte); restul cuvintelor formeaza modelul
    private ParsedVehicle withModel(String make, List<String> tokens, int i, int length, String gluedModel, Integer year) {
        List<String> rest = new ArrayList<>();
        if (gluedModel != null) rest.add(gluedModel);
        rest.addAll(tokens.subList(0, i));
        rest.addAll(tokens.subList(i + length, tokens.size()));
        return new ParsedVehicle(make, model(make, String.join(" ", rest)), year);
    }

    private String findMake(String token) {
        String k = key(token);
        String alias = ALIASES.get(k);
        if (alias != null) k = key(alias);
        return makes.get(k);
    }

    // Toleram o litera gresita la cuvinte de 4 litere si doua la cele mai lungi, cu prima litera corecta
    // (altfel "lancia" ar deveni "dacia"); cuvintele scurte trebuie sa fie exacte
    private String findMakeFuzzy(String token) {
        String k = key(token);
        if (k.length() < 4 || !k.matches("[a-z]+")) return null;
        int maxDistance = k.length() >= 5 ? 2 : 1;
        String best = null;
        int bestDistance = Integer.MAX_VALUE;
        for (Map.Entry<String, String> m : makes.entrySet()) {
            if (m.getKey().isEmpty() || m.getKey().charAt(0) != k.charAt(0)) continue;
            int d = distance(k, m.getKey());
            if (d <= maxDistance && d < bestDistance) {
                best = m.getValue();
                bestDistance = d;
            }
        }
        for (Map.Entry<String, String> a : ALIASES.entrySet()) {
            if (a.getKey().charAt(0) != k.charAt(0)) continue;
            int d = distance(k, a.getKey());
            if (a.getKey().length() >= 4 && d <= maxDistance && d < bestDistance && makes.containsKey(key(a.getValue()))) {
                best = makes.get(key(a.getValue()));
                bestDistance = d;
            }
        }
        return best;
    }

    // Distanta Damerau-Levenshtein (cu inversarea a doua litere vecine, ex. "rebualt" ~ "renault")
    static int distance(String a, String b) {
        int[][] d = new int[a.length() + 1][b.length() + 1];
        for (int i = 0; i <= a.length(); i++) d[i][0] = i;
        for (int j = 0; j <= b.length(); j++) d[0][j] = j;
        for (int i = 1; i <= a.length(); i++) {
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                d[i][j] = Math.min(Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1), d[i - 1][j - 1] + cost);
                if (i > 1 && j > 1 && a.charAt(i - 1) == b.charAt(j - 2) && a.charAt(i - 2) == b.charAt(j - 1)) {
                    d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
                }
            }
        }
        return d[a.length()][b.length()];
    }

    private String model(String make, String raw) {
        if (raw.isBlank()) return null;
        String known = modelsByMake.getOrDefault(make, Map.of()).get(key(raw));
        return known != null ? known : titleCase(raw);
    }

    // Comparatie fara majuscule, diacritice, spatii si cratime ("Citroën" = "citroen", "Mercedes-Benz" = "mercedes benz")
    public static String key(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[\\s\\-]", "");
    }

    // "santa fee" -> "Santa Fee"; codurile cu cifre si cele foarte scurte se scriu cu majuscule ("xc60" -> "XC60", "cc" -> "CC")
    static String titleCase(String s) {
        return Arrays.stream(s.trim().split("\\s+"))
                .map(w -> w.matches(".*\\d.*") || w.length() <= 2 ? w.toUpperCase(Locale.ROOT)
                        : w.substring(0, 1).toUpperCase(Locale.ROOT) + w.substring(1).toLowerCase(Locale.ROOT))
                .collect(Collectors.joining(" "));
    }
}
