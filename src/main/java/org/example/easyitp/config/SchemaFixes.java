package org.example.easyitp.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

// Corectii de schema pe care ddl-auto=update nu le face singur.
// Hibernate pune pe coloanele enum un CHECK cu valorile de la crearea tabelului; o valoare noua
// (ex. rolul FLEET) ar fi respinsa de Postgres, asa ca scoatem constrangerea (enum-ul e validat oricum in Java).
@Component
@Order(0)
@RequiredArgsConstructor
@Slf4j
public class SchemaFixes implements CommandLineRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(String... args) {
        try {
            jdbc.execute("ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check");
        } catch (Exception e) {
            log.warn("Nu am putut actualiza constrangerea de rol: {}", e.getMessage());
        }
    }
}
