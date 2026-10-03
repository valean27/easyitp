package org.example.easyitp.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.example.easyitp.dto.RegistrationScanDTO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDate;
import java.time.Year;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// Citeste talonul (certificatul de inmatriculare) dintr-o poza, cu Claude Haiku (API Anthropic).
// Poza nu se salveaza nicaieri: se trimite o singura data la Anthropic si se uita.
@Service
@Slf4j
public class RegistrationScanService {

    private static final String TOOL_NAME = "date_talon";
    // Plafon de cost: o statie face cateva zeci de ITP-uri pe zi
    static final int MAX_SCANS_PER_DAY = 200;

    private static final String PROMPT = """
            Poza ar trebui sa fie un certificat de inmatriculare romanesc (talon) sau o pagina din el.
            Citeste campurile cu codurile lor standard:
            A = numarul de inmatriculare, E = seria de sasiu (VIN, 17 caractere), D.1 = marca,
            D.3 = denumirea comerciala (modelul), B = data primei inmatriculari,
            C.2.1 + C.2.2 sau C.1.1 + C.1.2 = numele si prenumele titularului.
            Copiaza exact ce scrie, fara sa ghicesti; un camp care nu se vede sau nu se poate citi sigur ramane null.
            Raspunde doar apeland unealta date_talon.""";

    // Raspunsul structurat cerut modelului (tool use fortat)
    private static final Map<String, Object> TOOL = Map.of(
            "name", TOOL_NAME,
            "description", "Datele citite de pe talon",
            "input_schema", Map.of(
                    "type", "object",
                    "properties", Map.of(
                            "esteTalon", Map.of("type", "boolean", "description", "true daca poza arata un certificat de inmatriculare"),
                            "numarInmatriculare", Map.of("type", List.of("string", "null"), "description", "campul A"),
                            "vin", Map.of("type", List.of("string", "null"), "description", "campul E"),
                            "marca", Map.of("type", List.of("string", "null"), "description", "campul D.1"),
                            "model", Map.of("type", List.of("string", "null"), "description", "campul D.3"),
                            "anFabricatie", Map.of("type", List.of("integer", "null"), "description", "anul fabricatiei daca apare, altfel anul din campul B"),
                            "titular", Map.of("type", List.of("string", "null"), "description", "numele complet al titularului")),
                    "required", List.of("esteTalon")));

    private final RestClient client;
    private final String apiKey;
    private final String model;
    private final CarService carService;
    // utilizator -> (zi, scanari facute in ziua respectiva)
    private final Map<Long, DailyCount> scansToday = new ConcurrentHashMap<>();

    private record DailyCount(LocalDate day, int count) {
    }

    public RegistrationScanService(@Value("${anthropic.url:https://api.anthropic.com}") String baseUrl,
                                   @Value("${anthropic.api-key:}") String apiKey,
                                   @Value("${anthropic.model:claude-haiku-4-5-20251001}") String model,
                                   CarService carService) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(60));
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
        this.apiKey = apiKey;
        this.model = model;
        this.carService = carService;
    }

    public RegistrationScanDTO scan(Long userId, byte[] image, String mediaType) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Scanarea talonului nu este configurată pe server.");
        }
        LocalDate today = LocalDate.now();
        DailyCount used = scansToday.merge(userId, new DailyCount(today, 1),
                (old, one) -> old.day().equals(today) ? new DailyCount(today, old.count() + 1) : one);
        if (used.count() > MAX_SCANS_PER_DAY) {
            refund(userId, today);
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Ați atins limita de scanări pentru azi.");
        }
        try {
            return callModel(image, mediaType);
        } catch (ResponseStatusException e) {
            // Serviciul n-a raspuns sau n-a intors campurile: nu e vina utilizatorului, scanarea nu se numara
            if (e.getStatusCode().is5xxServerError()) refund(userId, today);
            throw e;
        }
    }

    private void refund(Long userId, LocalDate day) {
        scansToday.computeIfPresent(userId,
                (id, c) -> c.day().equals(day) && c.count() > 0 ? new DailyCount(day, c.count() - 1) : c);
    }

    private RegistrationScanDTO callModel(byte[] image, String mediaType) {
        Map<String, Object> request = Map.of(
                "model", model,
                "max_tokens", 1024,
                "tools", List.of(TOOL),
                "tool_choice", Map.of("type", "tool", "name", TOOL_NAME),
                "messages", List.of(Map.of(
                        "role", "user",
                        "content", List.of(
                                Map.of("type", "image", "source", Map.of(
                                        "type", "base64",
                                        "media_type", mediaType,
                                        "data", Base64.getEncoder().encodeToString(image))),
                                Map.of("type", "text", "text", PROMPT)))));

        JsonNode response;
        try {
            response = client.post()
                    .uri("/v1/messages")
                    .header("x-api-key", apiKey.trim())
                    .header("anthropic-version", "2023-06-01")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException e) {
            log.warn("Anthropic a raspuns {}: {}", e.getStatusCode().value(), abbreviate(e.getResponseBodyAsString()));
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Talonul nu a putut fi citit acum. Încercați din nou.");
        } catch (RestClientException e) {
            log.warn("Anthropic indisponibil: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Serviciul de scanare nu răspunde. Încercați din nou.");
        }

        JsonNode fields = null;
        if (response != null) {
            for (JsonNode block : response.path("content")) {
                if ("tool_use".equals(block.path("type").asText())) fields = block.path("input");
            }
        }
        if (fields == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Talonul nu a putut fi citit acum. Încercați din nou.");
        }
        if (!fields.path("esteTalon").asBoolean(false)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Poza nu pare să fie un talon. Fotografiați talonul întreg, drept și fără reflexii.");
        }
        return toDto(fields);
    }

    RegistrationScanDTO toDto(JsonNode fields) {
        List<String> warnings = new ArrayList<>();

        String plate = text(fields, "numarInmatriculare");
        if (plate != null) plate = plate.toUpperCase(Locale.ROOT).replaceAll("\\s+", " ");

        String vin = text(fields, "vin");
        if (vin != null) {
            vin = vin.toUpperCase(Locale.ROOT).replaceAll("[\\s-]", "");
            if (!vin.matches("[A-Z0-9]{17}")) {
                warnings.add("Seria de șasiu citită („" + vin + "”) nu are 17 caractere; completați-o de mână.");
                vin = null;
            }
        }

        // Marca si modelul trec prin dictionar: "VOLKSWAGEN" + "GOLF" -> "Volkswagen" / "Golf"
        String brand = null;
        String vehicleModel = null;
        String rawMake = text(fields, "marca");
        String rawModel = text(fields, "model");
        if (rawMake != null || rawModel != null) {
            VehicleNameParser.ParsedVehicle parsed = carService.vehicleNameParser()
                    .parse(((rawMake == null ? "" : rawMake) + " " + (rawModel == null ? "" : rawModel)).trim());
            brand = "Necunoscut".equals(parsed.brand()) ? null : parsed.brand();
            vehicleModel = parsed.model();
        }

        Integer year = fields.path("anFabricatie").canConvertToInt() ? fields.path("anFabricatie").asInt() : null;
        if (year != null && (year < 1950 || year > Year.now().getValue() + 1)) year = null;

        String owner = text(fields, "titular");
        if (owner != null) owner = VehicleNameParser.titleCase(owner);

        if (plate == null) warnings.add("Numărul de înmatriculare nu s-a putut citi.");
        return new RegistrationScanDTO(plate, vin, brand, vehicleModel, year, owner, warnings);
    }

    private static String text(JsonNode fields, String name) {
        JsonNode node = fields.path(name);
        if (node.isMissingNode() || node.isNull()) return null;
        String value = node.asText().strip();
        return value.isEmpty() ? null : value;
    }

    private static String abbreviate(String s) {
        return s == null ? "" : s.length() > 300 ? s.substring(0, 300) : s;
    }
}
