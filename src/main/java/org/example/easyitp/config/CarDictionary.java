package org.example.easyitp.config;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// Marcile si modelele din car-dictionary.txt ("Marca: model, model, ..."), in ordinea din fisier
public final class CarDictionary {

    private static final String RESOURCE = "/car-dictionary.txt";

    private CarDictionary() {
    }

    public static Map<String, List<String>> load() {
        try (InputStream in = CarDictionary.class.getResourceAsStream(RESOURCE)) {
            if (in == null) throw new IllegalStateException(RESOURCE + " lipseste din classpath");
            Map<String, List<String>> data = new LinkedHashMap<>();
            BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.strip();
                if (line.isEmpty() || line.startsWith("#")) continue;
                int colon = line.indexOf(':');
                if (colon <= 0) throw new IllegalStateException("Linie invalida in " + RESOURCE + ": " + line);
                List<String> models = Arrays.stream(line.substring(colon + 1).split(","))
                        .map(String::strip)
                        .filter(m -> !m.isEmpty())
                        .toList();
                data.put(line.substring(0, colon).strip(), models);
            }
            return data;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
