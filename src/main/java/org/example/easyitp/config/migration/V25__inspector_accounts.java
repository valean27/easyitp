package org.example.easyitp.config.migration;

import org.example.easyitp.service.InspectorLogins;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

// O singura data: cate un cont pentru fiecare inspector care exista deja, cu parola "changeme",
// care trebuie schimbata la prima logare. Numele de logare: prenume.nume@<adresa statiei>.
// (Spring Boot da migrarile Java declarate ca bean-uri lui Flyway; testele pe H2 nu ruleaza Flyway.)
@Component
public class V25__inspector_accounts extends BaseJavaMigration {

    static final String INITIAL_PASSWORD = "changeme";

    private record Row(long id, String name, boolean active, long stationId, String slug, String stationName) {
    }

    @Override
    public void migrate(Context context) throws Exception {
        Connection c = context.getConnection();
        Set<String> taken = new HashSet<>();
        try (PreparedStatement ps = c.prepareStatement("SELECT email FROM app_users"); ResultSet rs = ps.executeQuery()) {
            while (rs.next()) taken.add(rs.getString(1).toLowerCase(Locale.ROOT));
        }
        List<Row> rows = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement("""
                SELECT i.id, i.name, i.active, u.id, u.booking_slug, u.station_name
                FROM inspectors i JOIN app_users u ON u.id = i.user_id
                WHERE NOT EXISTS (SELECT 1 FROM app_users a WHERE a.inspector_id = i.id)
                ORDER BY i.user_id, i.position, i.id
                """); ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                rows.add(new Row(rs.getLong(1), rs.getString(2), rs.getBoolean(3), rs.getLong(4), rs.getString(5), rs.getString(6)));
            }
        }
        if (rows.isEmpty()) return;
        String hash = new BCryptPasswordEncoder().encode(INITIAL_PASSWORD);
        try (PreparedStatement insert = c.prepareStatement("""
                INSERT INTO app_users (email, password, role, active, inspector_id, password_change_required, station_name, created_at, token_version)
                VALUES (?, ?, 'INSPECTOR', ?, ?, true, ?, ?, 0)
                """)) {
            for (Row r : rows) {
                String login = InspectorLogins.suggest(r.name(), r.slug(), r.stationId(), taken::contains);
                taken.add(login);
                insert.setString(1, login);
                insert.setString(2, hash);
                insert.setBoolean(3, r.active());
                insert.setLong(4, r.id());
                insert.setString(5, r.stationName());
                insert.setTimestamp(6, Timestamp.valueOf(LocalDateTime.now()));
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }
}
