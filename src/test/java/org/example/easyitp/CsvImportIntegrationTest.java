package org.example.easyitp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Role;
import org.example.easyitp.entity.Vehicle;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.CarMakeRepository;
import org.example.easyitp.repository.VehicleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Importul CSV in formatul exportat din Excel de statii (date "9-mar.-2026", randuri goale, telefoane fara 0)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class CsvImportIntegrationTest {

    private static final String HEADER = "Nume sofer,Contact,Marca vehicul,VIN,Numar inmatriculare,Data efectuare ITP,"
            + "Perioada valabilitate ITP (luni),Data urmatorul ITP,Zile ramase ITP\n";

    private static final String FILE = HEADER
            + "Ion Pop,739963246,dacia logan,www,mm50wvw,9-mar.-2026,12,9-mar.-2027,157\n"
            + "Ana Rus,749984563,VW,VWV,MM30TRY,10-sept.-2026,24,10-sept.-2028,700\n"
            + "Dan Ilie,,passat,wvw,mm 10-jom,24-mar.-2026,12,24-mar.-2027,172\n"
            + "Eva Pop,758173191,renualt megane,vf1,MM15XYZ,2-iun.-2026,12,2-iun.-2027,240\n"
            + "Eva Pop,758173191,renualt megane,vf1,mm15xyz,2-iun.-2026,12,2-iun.-2027,240\n"  // rand dublat
            + "Fara Numar,722111222,dacie logan,xxx,,20-mai-2026,12,20-mai-2027,200\n"
            + ",,,,,,,-,-\n"
            + ",,,,,,,-,-\n";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private VehicleRepository vehicles;
    @Autowired private CarMakeRepository makes;
    @Autowired private PasswordEncoder encoder;

    private String token;

    @BeforeEach
    void setUp() throws Exception {
        users.save(AppUser.builder().email("import@itp.ro").password(encoder.encode("secret12")).role(Role.MANAGER).build());
        token = json.readTree(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"import@itp.ro\",\"password\":\"secret12\"}"))
                .andReturn().getResponse().getContentAsString()).get("token").asText();
    }

    @Test
    void importsCleansDataAndReportsProblems() throws Exception {
        long makesBefore = makes.count();
        JsonNode result = upload(FILE);

        assertThat(result.get("imported").asInt()).isEqualTo(4);
        assertThat(result.get("updated").asInt()).isEqualTo(1); // randul dublat suprascrie, nu dubleaza
        assertThat(result.get("errors").toString()).contains("Linia 7").contains("numărul de înmatriculare");

        JsonNode dashboard = dashboard();
        assertThat(dashboard).hasSize(4);
        JsonNode ion = find(dashboard, "MM50WVW");
        assertThat(ion.get("contact").asText()).isEqualTo("0739963246");
        assertThat(ion.get("marca").asText()).isEqualTo("Dacia");
        assertThat(ion.get("model").asText()).isEqualTo("Logan");
        assertThat(ion.get("vin").isNull()).isTrue(); // "www" nu e un VIN
        assertThat(find(dashboard, "MM30TRY").get("dataItp").asText()).isEqualTo("2026-09-10");
        assertThat(find(dashboard, "MM30TRY").get("marca").asText()).isEqualTo("Volkswagen");
        assertThat(find(dashboard, "MM 10-JOM").get("marca").asText()).isEqualTo("Volkswagen");
        assertThat(find(dashboard, "MM15XYZ").get("marca").asText()).isEqualTo("Renault");

        // nicio marca noua de tipul "dacia logan" in dictionar
        assertThat(makes.count()).isEqualTo(makesBefore);
    }

    @Test
    void reimportOverwritesInsteadOfDuplicating() throws Exception {
        upload(FILE);
        String changed = FILE.replace("Ion Pop,739963246,dacia logan,www,mm50wvw,9-mar.-2026,12",
                "Ion Popescu,722000000,dacia logan,www,MM 50 WVW,9-mar.-2026,24");

        JsonNode result = upload(changed);
        assertThat(result.get("imported").asInt()).isZero();
        assertThat(result.get("updated").asInt()).isEqualTo(5);

        JsonNode dashboard = dashboard();
        assertThat(dashboard).hasSize(4);
        JsonNode ion = find(dashboard, "MM 50 WVW");
        assertThat(ion.get("numeSofer").asText()).isEqualTo("Ion Popescu");
        assertThat(ion.get("contact").asText()).isEqualTo("0722000000");
        assertThat(ion.get("valabilitateLuni").asInt()).isEqualTo(24);
        assertThat(vehicles.findAll().stream().map(Vehicle::getLicensePlate).filter(p -> p.replace(" ", "").equals("MM50WVW"))).hasSize(1);
    }

    @Test
    void newItpDateForKnownVehicleIsKeptAsHistory() throws Exception {
        upload(FILE);
        JsonNode result = upload(HEADER + "Ion Pop,739963246,dacia logan,www,mm50wvw,9-mar.-2027,12,,\n");
        assertThat(result.get("imported").asInt()).isEqualTo(1);

        JsonNode dashboard = dashboard();
        assertThat(dashboard).hasSize(5);
        long latest = 0;
        for (JsonNode row : dashboard) {
            if (row.get("numarInmatriculare").asText().equals("MM50WVW") && row.get("ultimul").asBoolean()) latest++;
        }
        assertThat(latest).isEqualTo(1);
    }

    private JsonNode upload(String csv) throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "itp.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));
        return json.readTree(mvc.perform(multipart("/api/itp/import").file(file).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private JsonNode dashboard() throws Exception {
        return json.readTree(mvc.perform(get("/api/itp/dashboard").header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private static JsonNode find(JsonNode rows, String plate) {
        for (JsonNode row : rows) {
            if (row.get("numarInmatriculare").asText().equals(plate)) return row;
        }
        throw new AssertionError("Lipseste " + plate);
    }
}
