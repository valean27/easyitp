package org.example.easyitp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.easyitp.entity.AppUser;
import org.example.easyitp.entity.Appointment;
import org.example.easyitp.entity.AppointmentStatus;
import org.example.easyitp.entity.Role;
import org.example.easyitp.repository.AppUserRepository;
import org.example.easyitp.repository.AppointmentRepository;
import org.example.easyitp.repository.ClientRepository;
import org.example.easyitp.repository.VehicleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Clienti si vehicule (B1): un om cu mai multe masini, editarea fara rescrierea istoricului, curatarea, pagina "Clienti"
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ClientIntegrationTest {

    private static final String PASSWORD = "secret12";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppUserRepository users;
    @Autowired private ClientRepository clients;
    @Autowired private VehicleRepository vehicles;
    @Autowired private AppointmentRepository appointments;
    @Autowired private PasswordEncoder encoder;

    private String manager;
    private String other;
    private AppUser managerUser;
    private final LocalDate today = LocalDate.now();

    @BeforeEach
    void setUp() throws Exception {
        managerUser = users.save(AppUser.builder().email("c1@itp.ro").password(encoder.encode(PASSWORD)).role(Role.MANAGER).build());
        users.save(AppUser.builder().email("c2@itp.ro").password(encoder.encode(PASSWORD)).role(Role.MANAGER).build());
        manager = login("c1@itp.ro");
        other = login("c2@itp.ro");
    }

    @Test
    void samePersonWithTwoCarsIsOneClient() throws Exception {
        createItp("Ion Popescu", "0722 111 222", "CJ01AAA", today.minusDays(3));
        createItp("ion  popescu", "+40722111222", "CJ02BBB", today.minusDays(2));
        createItp("Ion Popescu", "0744 999 999", "CJ03CCC", today.minusDays(1)); // alt telefon: alta persoana

        JsonNode list = getJson("/api/clients?q=popescu", manager);
        assertThat(list.get("total").asLong()).isEqualTo(2);
        JsonNode ion = list.get("items").get(0).get("vehicleCount").asInt() == 2 ? list.get("items").get(0) : list.get("items").get(1);
        assertThat(ion.get("vehicleCount").asInt()).isEqualTo(2);
        assertThat(ion.get("plates").toString()).contains("CJ01AAA").contains("CJ02BBB");

        // cautare dupa numar (fara spatii) si dupa telefon
        assertThat(getJson("/api/clients?q=cj 02", manager).get("total").asLong()).isEqualTo(1);
        assertThat(getJson("/api/clients?q=744999", manager).get("total").asLong()).isEqualTo(1);
        // alta statie nu vede nimic
        assertThat(getJson("/api/clients?q=popescu", other).get("total").asLong()).isZero();
    }

    @Test
    void changingThePlateOnAnOldItpMovesOnlyThatItp() throws Exception {
        long old = createItp("Ana", "0722 000 001", "B10ANA", today.minusYears(1));
        long recent = createItp("Ana", "0722 000 001", "B10ANA", today.minusDays(5));

        // numarul gresit pe ITP-ul vechi: doar el trece pe o masina noua
        send(put("/api/itp/" + old), itpBody("Ana", "0722 000 001", "B11ANA", today.minusYears(1))).andExpect(status().isNoContent());
        assertThat(getJson("/api/itp/history?plate=B10ANA", manager)).hasSize(1);
        assertThat(getJson("/api/itp/history?plate=B10ANA", manager).get(0).get("id").asLong()).isEqualTo(recent);
        assertThat(getJson("/api/itp/history?plate=B11ANA", manager).get(0).get("id").asLong()).isEqualTo(old);

        // si inapoi pe numarul corect: se alatura masinii existente, masina goala dispare
        long before = vehicles.count();
        send(put("/api/itp/" + old), itpBody("Ana", "0722 000 001", "b10-ana", today.minusYears(1))).andExpect(status().isNoContent());
        assertThat(getJson("/api/itp/history?plate=B10ANA", manager)).hasSize(2);
        assertThat(vehicles.count()).isEqualTo(before - 1);
    }

    @Test
    void aCarSoldToSomeoneElseMovesWithoutRenamingTheOldOwner() throws Exception {
        createItp("Dan Vechi", "0722 000 002", "CJ20DAN", today.minusYears(1));
        createItp("Dan Vechi", "0722 000 002", "CJ21DAN", today.minusYears(1));
        createItp("Maria Noua", "0733 000 003", "CJ20DAN", today);

        assertThat(getJson("/api/clients?q=dan vechi", manager).get("items").get(0).get("vehicleCount").asInt()).isEqualTo(1);
        assertThat(getJson("/api/clients?q=maria", manager).get("items").get(0).get("plates").toString()).contains("CJ20DAN");
    }

    @Test
    void deletingTheLastItpRemovesTheCarTheClientAndTheAppointmentLink() throws Exception {
        long id = createItp("Singur", "0722 000 004", "SB01ONE", today);
        appointments.save(Appointment.builder().user(managerUser).clientName("Singur").appointmentDate(today.atTime(10, 0))
                .status(AppointmentStatus.COMPLETED).itpRecordId(id).build());
        long clientsBefore = clients.count();

        mvc.perform(delete("/api/itp/" + id).header("Authorization", "Bearer " + manager)).andExpect(status().isNoContent());
        assertThat(clients.count()).isEqualTo(clientsBefore - 1);
        assertThat(getJson("/api/clients?q=singur", manager).get("total").asLong()).isZero();
        assertThat(appointments.findAll()).allMatch(a -> a.getItpRecordId() == null);
    }

    @Test
    void invalidItpFormsAreRejectedWithAMessage() throws Exception {
        send(post("/api/itp"), itpBody("Fara data", "0722", "CJ99AAA", null))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Introduceți data ITP"));
        send(post("/api/itp"), itpBody("Viitor", "0722", "CJ99AAA", today.plusMonths(2)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").isNotEmpty());
        send(post("/api/itp"), itpBody(" ", "0722", "CJ99AAA", today))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Introduceți numele clientului"));
    }

    @Test
    void clientPageEditsMovesMergesAndDeletes() throws Exception {
        createItp("Vasile", "0722 000 005", "VS01AAA", today.minusDays(10));
        createItp("Vasile", "0722 000 005", "VS02BBB", today.minusDays(9));
        createItp("Vasile Ionescu", "0722 000 005", "VS03CCC", today.minusDays(8));
        long vasile = clientId("VS01AAA");
        long ionescu = clientId("VS03CCC");

        // acelasi telefon -> apar ca posibile dubluri
        assertThat(getJson("/api/clients/duplicates", manager).toString()).contains("Același telefon");

        JsonNode detail = getJson("/api/clients/" + vasile, manager);
        assertThat(detail.get("vehicles")).hasSize(2);
        assertThat(detail.get("vehicles").get(0).get("itps")).hasSize(1);
        long vs02 = vehicleId(detail, "VS02BBB");

        // editare client si masina; numar deja folosit -> 409
        send(put("/api/clients/" + vasile), Map.of("name", "Vasile Pop", "phone", "0722 000 005"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Vasile Pop"));
        send(put("/api/clients/vehicles/" + vs02), Map.of("licensePlate", "vs03ccc", "brand", "Dacia"))
                .andExpect(status().isConflict());
        send(put("/api/clients/vehicles/" + vs02), Map.of("licensePlate", "vs 09 zzz", "brand", "Skoda", "year", 2019))
                .andExpect(status().isOk());
        assertThat(getJson("/api/itp/history?plate=VS09ZZZ", manager)).hasSize(1);

        // mutare masina, apoi unire: totul ajunge la un singur client
        send(post("/api/clients/vehicles/" + vs02 + "/move"), Map.of("clientId", ionescu))
                .andExpect(status().isOk()).andExpect(jsonPath("$.vehicles.length()").value(2));
        send(post("/api/clients/" + vasile + "/merge"), Map.of("clientId", ionescu))
                .andExpect(status().isOk()).andExpect(jsonPath("$.vehicles.length()").value(3));
        mvc.perform(get("/api/clients/" + vasile).header("Authorization", "Bearer " + manager)).andExpect(status().isNotFound());

        // alta statie nu poate atinge clientul
        mvc.perform(delete("/api/clients/" + ionescu).header("Authorization", "Bearer " + other)).andExpect(status().isNotFound());

        // stergerea clientului sterge masinile si ITP-urile
        mvc.perform(delete("/api/clients/" + ionescu).header("Authorization", "Bearer " + manager)).andExpect(status().isNoContent());
        assertThat(getJson("/api/itp/records?q=VS0&onlyLatest=false", manager).get("total").asLong()).isZero();
    }

    // ---------- ajutatoare ----------

    private long clientId(String plate) throws Exception {
        return getJson("/api/clients?q=" + plate, manager).get("items").get(0).get("id").asLong();
    }

    private static long vehicleId(JsonNode detail, String plate) {
        for (JsonNode v : detail.get("vehicles")) if (v.get("licensePlate").asText().equals(plate)) return v.get("id").asLong();
        throw new AssertionError("Masina " + plate + " lipseste");
    }

    private String login(String email) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    private JsonNode getJson(String url, String token) throws Exception {
        String body = mvc.perform(get(url).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return json.readTree(body);
    }

    private ResultActions send(MockHttpServletRequestBuilder request, Object body) throws Exception {
        return mvc.perform(request.header("Authorization", "Bearer " + manager)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }

    private Map<String, Object> itpBody(String name, String phone, String plate, LocalDate testDate) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("phone", phone);
        body.put("brand", "Dacia");
        body.put("licensePlate", plate);
        body.put("testDate", testDate == null ? null : testDate.toString());
        body.put("validityMonths", 12);
        body.put("price", 150);
        return body;
    }

    private long createItp(String name, String phone, String plate, LocalDate testDate) throws Exception {
        String body = send(post("/api/itp"), itpBody(name, phone, plate, testDate))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asLong();
    }
}
