package dev.ritmo;

import dev.ritmo.shared.Json;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.DriverManager;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import static org.assertj.core.api.Assertions.assertThat;

class RetentionLifecycleTests {
    record Api(ConfigurableApplicationContext context,String origin) implements AutoCloseable {
        @Override public void close() {context.close();}
    }
    Api start(PostgreSQLContainer db,Map<String,String> overrides) {
        var settings=new LinkedHashMap<String,String>();
        settings.put("server.port","0");settings.put("server.address","127.0.0.1");
        settings.put("logging.level.root","ERROR");settings.put("spring.main.banner-mode","off");
        settings.put("spring.datasource.url",db.getJdbcUrl());settings.put("spring.datasource.username","ritmo_domain");settings.put("spring.datasource.password","test-domain");
        settings.put("spring.flyway.url",db.getJdbcUrl());settings.put("spring.flyway.user",db.getUsername());settings.put("spring.flyway.password",db.getPassword());
        settings.put("ritmo.identity.url",db.getJdbcUrl());settings.put("ritmo.identity.username","ritmo_identity");settings.put("ritmo.identity.password","test-identity");
        settings.put("ritmo.signing-key",Base64.getEncoder().encodeToString(new byte[32]));
        settings.put("ritmo.sync-retention.batch-records","1");settings.put("ritmo.sync-retention.accounts","1");
        settings.put("ritmo.sync-retention.poll-ms","100");settings.putAll(overrides);
        var context=new SpringApplicationBuilder(RitmoApplication.class).run(settings.entrySet().stream().map(e->"--"+e.getKey()+"="+e.getValue()).toArray(String[]::new));
        return new Api(context,"http://127.0.0.1:"+context.getEnvironment().getRequiredProperty("local.server.port",Integer.class));
    }
    JsonNode post(Api api,String path,String token,JsonNode body) throws Exception {
        var request=HttpRequest.newBuilder(URI.create(api.origin()+"/api/v1/"+path)).timeout(java.time.Duration.ofSeconds(15))
            .header("Content-Type","application/json").header("X-Ritmo-Protocol","m1.1").header("X-App-Version","0.1.0").header("Idempotency-Key",Json.id());
        if(token!=null) request.header("Authorization","Bearer "+token);
        var response=HttpClient.newHttpClient().send(request.POST(HttpRequest.BodyPublishers.ofString(body.toString())).build(),HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(response.body()).isIn(200,201);return Json.read(response.body());
    }
    JsonNode metadata(PostgreSQLContainer db,String user) throws Exception {
        try(var connection=DriverManager.getConnection(db.getJdbcUrl(),db.getUsername(),db.getPassword());
            var statement=connection.prepareStatement("""
                select jsonb_build_object('floor',s.feed_compacted_through::text,'epoch',s.feed_epoch,
                 'completed',s.retention_completed_at::text,'next',s.retention_next_at::text,
                 'envelopes',(select count(*) from sync_changes c where c.user_id=s.user_id))
                from sync_account_state s where s.user_id=?::uuid
                """)) {
            statement.setString(1,user);try(var rows=statement.executeQuery()) {rows.next();return Json.read(rows.getString(1));}
        }
    }
    void awaitFloor(PostgreSQLContainer db,String user,long floor) throws Exception {
        long deadline=System.nanoTime()+java.time.Duration.ofSeconds(10).toNanos();
        while(Long.parseLong(metadata(db,user).path("floor").asString())<floor&&System.nanoTime()<deadline) Thread.sleep(20);
        assertThat(metadata(db,user).path("floor").asString()).isEqualTo(Long.toString(floor));
    }
    @Test @Timeout(150)
    void unfinishedDailyWorkSurvivesRuntimeRestartAndTwoExecutorsAndQuarantinePausesIt() throws Exception {
        try(var db=new PostgreSQLContainer("postgres@sha256:5a5a84b19854a9ffaa54082c166ff4ec27473a361e496e5ea167f298f2da9722")) {
            db.start();
            try(var connection=DriverManager.getConnection(db.getJdbcUrl(),db.getUsername(),db.getPassword());var statement=connection.createStatement()) {
                statement.execute("create role ritmo_domain login password 'test-domain';create role ritmo_identity login password 'test-identity';");
            }
            String user,token,habit=Json.id(),device=Json.id();JsonNode original;
            try(var api=start(db,Map.of("ritmo.sync-retention.poll-ms","1000"))) {
                var session=post(api,"auth/register",null,Json.object().put("email",Json.id()+"@example.test").put("displayName","Pessoa").put("password","fixture-password").put("deviceId",device));
                user=session.path("accountId").asString();token=session.path("accessToken").asString();
                var operations=Json.array();
                for(int sequence=1;sequence<=6;sequence++) {
                    var occurredAt=Instant.now();
                    var command=sequence==1?Json.read("""
                        {"type":"habit.create","habitId":"%s","title":"Caminhar","habitType":"binary","scheduleKind":"daily","startDayKey":"%s",
                        "timeContext":{"timezone":"UTC","dayStartHour":0},"iconKey":null,"colorToken":null,"sortOrder":0}
                        """.formatted(habit,occurredAt.atZone(java.time.ZoneOffset.UTC).toLocalDate())):Json.read("{\"type\":\"habit.patchMetadata\",\"habitId\":\""+habit+"\",\"patch\":{\"title\":\"Edição "+sequence+"\"}}");
                    var operation=Json.object().put("operationId",Json.id()).put("deviceId",device).put("clientSequence",sequence).put("occurredAt",occurredAt.toString());
                    operation.set("dependsOn",Json.array());operation.set("command",command);operations.add(operation);
                }
                var body=Json.object();body.set("operations",operations);
                assertThat(post(api,"sync/push",token,body).path("results").size()).isEqualTo(6);
                original=metadata(db,user);
                try(var owner=DriverManager.getConnection(db.getJdbcUrl(),db.getUsername(),db.getPassword())) {
                    owner.setAutoCommit(false);
                    try(var statement=owner.prepareStatement("update sync_changes set committed_at=now()-interval '2161 hours' where user_id=?::uuid")) {
                        statement.setString(1,user);statement.executeUpdate();
                    }
                    try(var statement=owner.prepareStatement("update sync_account_state set retention_next_at='-infinity' where user_id=?::uuid")) {
                        statement.setString(1,user);statement.executeUpdate();
                    }
                    owner.commit();
                }
                awaitFloor(db,user,1);
            }
            assertThat(metadata(db,user).path("floor").asString()).isEqualTo("1");
            assertThat(metadata(db,user).path("envelopes").asInt()).isEqualTo(5);
            try(var owner=DriverManager.getConnection(db.getJdbcUrl(),db.getUsername(),db.getPassword())) {
                owner.setAutoCommit(false);
                try(var statement=owner.prepareStatement("select last_revision from sync_account_state where user_id=?::uuid for update")) {
                    statement.setString(1,user);statement.executeQuery().close();
                }
                try(var first=start(db,Map.of());var second=start(db,Map.of())) {
                    owner.commit();awaitFloor(db,user,6);
                    assertThat(metadata(db,user).path("envelopes").asInt()).isZero();
                    assertThat(metadata(db,user).path("epoch").asString()).isEqualTo(original.path("epoch").asString());
                    var cut=post(first,"sync/snapshots",token,Json.object());
                    assertThat(cut.path("highWaterRevision").asString()).isEqualTo("6");
                }
            }
            var completed=metadata(db,user);
            try(var daily=start(db,Map.of())) {
                var command=Json.read("{\"type\":\"habit.patchMetadata\",\"habitId\":\""+habit+"\",\"patch\":{\"title\":\"Após concluir limpeza\"}}");
                var operation=Json.object().put("operationId",Json.id()).put("deviceId",device).put("clientSequence",7).put("occurredAt",Instant.now().toString());
                operation.set("dependsOn",Json.array());operation.set("command",command);
                var body=Json.object();body.set("operations",Json.array().add(operation));
                assertThat(post(daily,"sync/push",token,body).at("/results/0/receipt/acceptedRevision").asString()).isEqualTo("7");
                try(var owner=DriverManager.getConnection(db.getJdbcUrl(),db.getUsername(),db.getPassword())) {
                    try(var statement=owner.prepareStatement("update sync_changes set committed_at=now()-interval '2161 hours' where user_id=?::uuid")) {
                        statement.setString(1,user);statement.executeUpdate();
                    }
                    try(var statement=owner.prepareStatement("update sync_snapshots set expires_at=now()-interval '1 second' where user_id=?::uuid")) {
                        statement.setString(1,user);statement.executeUpdate();
                    }
                }
                Thread.sleep(350);
                assertThat(metadata(db,user).path("envelopes").asInt()).isEqualTo(1);
                assertThat(metadata(db,user).path("next").asString()).isEqualTo(completed.path("next").asString());
            }
            try(var owner=DriverManager.getConnection(db.getJdbcUrl(),db.getUsername(),db.getPassword());var statement=owner.prepareStatement("""
                update sync_account_state set retention_next_at='-infinity' where user_id=?::uuid
                """)) {statement.setString(1,user);statement.executeUpdate();}
            try(var quarantined=start(db,Map.of("ritmo.operations.quarantined","true"))) {
                Thread.sleep(350);
                assertThat(metadata(db,user).path("envelopes").asInt()).isEqualTo(1);
                assertThat(metadata(db,user).path("floor").asString()).isEqualTo("6");
            }
        }
    }

    @Test @Timeout(90)
    void anInvalidEnableFlagStopsStartupInsteadOfSilentlyDisablingMaintenance() throws Exception {
        try(var db=new PostgreSQLContainer("postgres@sha256:5a5a84b19854a9ffaa54082c166ff4ec27473a361e496e5ea167f298f2da9722")) {
            db.start();
            try(var connection=DriverManager.getConnection(db.getJdbcUrl(),db.getUsername(),db.getPassword());var statement=connection.createStatement()) {
                statement.execute("create role ritmo_domain login password 'test-domain';create role ritmo_identity login password 'test-identity';");
            }
            org.assertj.core.api.Assertions.assertThatThrownBy(()->{
                try(var invalid=start(db,Map.of("ritmo.sync-retention.enabled","yes"))) {
                    // Even an unexpectedly successful startup is closed before the assertion fails.
                }
            }).hasRootCauseInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test @Timeout(90)
    void upgradingAPopulatedV4DatabaseKeepsTheFeedAndItsReceipts() throws Exception {
        try(var db=new PostgreSQLContainer("postgres@sha256:5a5a84b19854a9ffaa54082c166ff4ec27473a361e496e5ea167f298f2da9722")) {
            db.start();
            try(var connection=DriverManager.getConnection(db.getJdbcUrl(),db.getUsername(),db.getPassword());var statement=connection.createStatement()) {
                statement.execute("create role ritmo_domain login password 'test-domain';create role ritmo_identity login password 'test-identity';");
            }
            String user,token,device=Json.id(),habit=Json.id();tools.jackson.databind.node.ObjectNode body;
            // Predecessor-schema fixture: only register/push are used; the new reader requires V5.
            try(var predecessor=start(db,Map.of("spring.flyway.target","4","ritmo.sync-retention.enabled","false"))) {
                var session=post(predecessor,"auth/register",null,Json.object().put("email",Json.id()+"@example.test").put("displayName","Pessoa").put("password","fixture-password").put("deviceId",device));
                user=session.path("accountId").asString();token=session.path("accessToken").asString();
                var occurredAt=Instant.now();
                var command=Json.read("""
                    {"type":"habit.create","habitId":"%s","title":"Antes da migration","habitType":"binary","scheduleKind":"daily","startDayKey":"%s",
                     "timeContext":{"timezone":"UTC","dayStartHour":0},"iconKey":null,"colorToken":null,"sortOrder":0}
                    """.formatted(habit,occurredAt.atZone(java.time.ZoneOffset.UTC).toLocalDate()));
                var operation=Json.object().put("operationId",Json.id()).put("deviceId",device).put("clientSequence",1).put("occurredAt",occurredAt.toString());
                operation.set("dependsOn",Json.array());operation.set("command",command);
                body=Json.object();body.set("operations",Json.array().add(operation));
                assertThat(post(predecessor,"sync/push",token,body).at("/results/0/receipt/acceptedRevision").asString()).isEqualTo("1");
            }
            try(var upgraded=start(db,Map.of("ritmo.sync-retention.enabled","false"))) {
                var state=metadata(db,user);
                assertThat(state.path("floor").asString()).isEqualTo("0");assertThat(state.path("envelopes").asInt()).isEqualTo(1);
                assertThat(state.path("next").asString()).isEqualTo("-infinity");assertThat(state.path("completed").isNull()).isTrue();
                var replay=post(upgraded,"sync/push",token,body);
                assertThat(replay.at("/results/0/replayed").asBoolean()).isTrue();
                assertThat(replay.at("/results/0/receipt/acceptedRevision").asString()).isEqualTo("1");
                assertThat(metadata(db,user).path("envelopes").asInt()).isEqualTo(1);
                var cut=post(upgraded,"sync/snapshots",token,Json.object());assertThat(cut.path("highWaterRevision").asString()).isEqualTo("1");
                try(var owner=DriverManager.getConnection(db.getJdbcUrl(),db.getUsername(),db.getPassword());
                    var statement=owner.createStatement();var rows=statement.executeQuery("select version from flyway_schema_history where success order by installed_rank desc limit 1")) {
                    rows.next();assertThat(rows.getString(1)).isEqualTo("5");
                }
            }
        }
    }
}
