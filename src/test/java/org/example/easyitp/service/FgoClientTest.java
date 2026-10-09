package org.example.easyitp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

// Clientul FGO: hash-ul din documentatia oficiala (v7) si cererile JSON
class FgoClientTest {

    private final ObjectMapper json = new ObjectMapper();

    @Test
    void hashMatchesTheFgoDocumentationExample() {
        assertThat(FgoClient.hash("2864518", "1234567890", "Ionescu Popescu")).isEqualTo("8C3A7726804C121C6933F7D68494B439463996E2");
    }

    @Test
    void issueSendsJsonWithAuthAndReadsTheInvoice() throws Exception {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        AtomicReference<String> sent = new AtomicReference<>();
        server.expect(requestTo(FgoClient.TEST + "/factura/emitere"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(r -> sent.set(r.getBody().toString()))
                .andRespond(withSuccess("{\"Success\":true,\"Message\":\"\",\"Factura\":{\"Numar\":\"7\",\"Serie\":\"EITP\","
                        + "\"Link\":\"https://fgo.ro/f/7.pdf\"}}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(FgoClient.TEST + "/factura/emitere"))
                .andRespond(withSuccess("{\"Success\":false,\"Message\":\"Hash invalid\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(FgoClient.TEST + "/factura/getstatus"))
                .andRespond(withSuccess("{\"Success\":false,\"Message\":\"Factura nu exista\"}", MediaType.APPLICATION_JSON));
        // asa raspunde FGO la erori (vazut pe serverul lor de test): HTTP 500, JSON cu exceptia si stack trace-ul
        server.expect(requestTo(FgoClient.TEST + "/factura/getstatus"))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"Success\":false,\"Message\":\"System.Exception: Codul unic nu exista sau nu este asociat.\\r\\n   at Fgo.PublicApi.Controllers.FacturaController.GetStatus()\"}"));

        FgoClient fgo = new FgoClient(builder);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("Serie", "EITP");
        body.put("Client", Map.of("Denumire", "ITP Exemplu SRL", "Tip", "PJ", "Tara", "RO"));
        body.put("Continut", List.of(Map.of("Denumire", "Abonament", "NrProduse", 1, "UM", "BUC", "CotaTVA", 21, "PretTotal", 59)));

        FgoClient.Issued issued = fgo.issue(FgoClient.TEST, "RO48267925", "cheie", "https://easyitp.ro", body);
        assertThat(issued).isEqualTo(new FgoClient.Issued("EITP", "7", "https://fgo.ro/f/7.pdf"));
        JsonNode request = json.readTree(sent.get());
        assertThat(request.get("CodUnic").asText()).isEqualTo("RO48267925");
        assertThat(request.get("Hash").asText()).isEqualTo(FgoClient.hash("RO48267925", "cheie", "ITP Exemplu SRL"));
        assertThat(request.get("PlatformaUrl").asText()).isEqualTo("https://easyitp.ro");
        assertThat(request.get("Client").get("Denumire").asText()).isEqualTo("ITP Exemplu SRL");
        assertThat(request.get("Continut").get(0).get("PretTotal").asInt()).isEqualTo(59);

        assertThatThrownBy(() -> fgo.issue(FgoClient.TEST, "RO48267925", "gresita", "https://easyitp.ro", body))
                .isInstanceOf(DeliveryException.class).hasMessage("FGO: Hash invalid");
        assertThat(fgo.probe(FgoClient.TEST, "RO48267925", "cheie", "https://easyitp.ro", "EITP")).isEqualTo("Factura nu exista");
        assertThat(fgo.probe(FgoClient.TEST, "RO48267925", "cheie", "https://easyitp.ro", "EITP"))
                .isEqualTo("Codul unic nu exista sau nu este asociat.");
        server.verify();
    }
}
