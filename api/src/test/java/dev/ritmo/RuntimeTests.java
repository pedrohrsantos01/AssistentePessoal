package dev.ritmo;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RuntimeTests {
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres@sha256:5a5a84b19854a9ffaa54082c166ff4ec27473a361e496e5ea167f298f2da9722");
    static {
        POSTGRES.start();
        try (var connection=java.sql.DriverManager.getConnection(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword()); var statement=connection.createStatement()) {
            statement.execute("CREATE ROLE ritmo_domain LOGIN PASSWORD 'test-domain'; CREATE ROLE ritmo_identity LOGIN PASSWORD 'test-identity';");
        } catch(java.sql.SQLException e) { throw new ExceptionInInitializerError(e); }
    }
    @DynamicPropertySource static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        properties.add("spring.datasource.username", ()->"ritmo_domain");
        properties.add("spring.flyway.url",POSTGRES::getJdbcUrl);
        properties.add("spring.flyway.user",POSTGRES::getUsername);
        properties.add("spring.flyway.password",POSTGRES::getPassword);
        properties.add("ritmo.identity.url",POSTGRES::getJdbcUrl);
        properties.add("ritmo.identity.username",()->"ritmo_identity");
        properties.add("ritmo.identity.password",()->"test-identity");
        properties.add("ritmo.signing-key",()->java.util.Base64.getEncoder().encodeToString(new byte[32]));
        properties.add("spring.datasource.password", ()->"test-domain");
    }
    @LocalServerPort int port;
    @Test void anAccountCanBeRegisteredThroughTheRealApi() throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/v1/auth/register"))
            .header("Content-Type", "application/json")
            .header("X-Ritmo-Protocol", "m1.1").header("X-App-Version", "0.1.0")
            .POST(HttpRequest.BodyPublishers.ofString("""
                {"email":"first@example.test","password":"fixture-password","displayName":"Pessoa",
                 "deviceId":"01996300-0000-7000-8000-000000000002"}
                """)).build();
        var response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(201);
        assertThat(response.body()).contains("\"accessToken\"").doesNotContain("password_hash");
    }
    private tools.jackson.databind.JsonNode post(String path,String token,String body,int expected) throws Exception {
        var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/v1/"+path))
            .header("Content-Type","application/json").header("X-Ritmo-Protocol","m1.1").header("X-App-Version","0.1.0")
            .header("Idempotency-Key",dev.ritmo.shared.Json.id());
        if(token!=null) request.header("Authorization","Bearer "+token);
        var response=HttpClient.newHttpClient().send(request.POST(HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(response.body()).isEqualTo(expected);
        return response.body().isEmpty()?dev.ritmo.shared.Json.object():dev.ritmo.shared.Json.read(response.body());
    }
    @Test void creatingAndMarkingARealHabitGrantsTenXp() throws Exception {
        var session=post("auth/register",null,"""
            {"email":"flow@example.test","password":"fixture-password","displayName":"Pessoa",
             "deviceId":"01996300-0000-7000-8000-000000000002"}
            """,201);
        String token=session.path("accessToken").asString();
        var create=post("sync/push",token,"""
            {"operations":[{"operationId":"01996300-0000-7000-8000-000000000010",
            "deviceId":"01996300-0000-7000-8000-000000000002","clientSequence":1,
            "occurredAt":"2026-09-25T13:00:00Z","dependsOn":[],"command":{
            "type":"habit.create","habitId":"01996300-0000-7000-8000-000000000003","title":"Caminhar",
            "habitType":"binary","scheduleKind":"daily","startDayKey":"2026-09-25",
            "timeContext":{"timezone":"America/Sao_Paulo","dayStartHour":4},"iconKey":null,"colorToken":null,"sortOrder":0}}]}
            """,200);
        assertThat(create.at("/results/0/receipt/status").asString()).isEqualTo("accepted");
        var mark=post("sync/push",token,"""
            {"operations":[{"operationId":"01996300-0000-7000-8000-000000000011",
            "deviceId":"01996300-0000-7000-8000-000000000002","clientSequence":2,
            "occurredAt":"2026-09-25T13:01:00Z","dependsOn":[],"command":{
            "type":"habit.mark","habitId":"01996300-0000-7000-8000-000000000003","dayKey":"2026-09-25",
            "timeContext":{"timezone":"America/Sao_Paulo","dayStartHour":4},"observedUndoIds":[]}}]}
            """,200);
        var grants=java.util.stream.StreamSupport.stream(mark.at("/results/0/projections").spliterator(),false)
            .filter(e->e.path("kind").asString().equals("xpGrant")).toList();
        assertThat(grants).hasSize(1);
        assertThat(grants.getFirst().at("/value/amount").asInt()).isEqualTo(10);
        assertThat(grants.getFirst().at("/value/active").asBoolean()).isTrue();
    }

    @Test void aNewClientReceivesAnAccountScopedSnapshot() throws Exception {
        var session=post("auth/register",null,"{\"email\":\"snapshot@example.test\",\"password\":\"fixture-password\",\"displayName\":\"Pessoa\",\"deviceId\":\"01996300-0000-7000-8000-000000000002\"}",201);
        var manifest=post("sync/snapshots",session.path("accessToken").asString(),"{}",201);
        assertThat(manifest.path("entityCount").asInt()).isEqualTo(1);
        assertThat(manifest.path("highWaterRevision").asString()).isEqualTo("0");
    }


    @Test void mobileRepositoriesSynchronizeThroughTheRealHttpApi() throws Exception {
        var log=java.nio.file.Path.of("build/mobile-integration.log");
        var builder=new ProcessBuilder("node","--import","tsx","--test","test/integration/sync.test.ts")
            .directory(java.nio.file.Path.of("../app").toFile()).redirectErrorStream(true).redirectOutput(log.toFile());
        builder.environment().put("RITMO_TEST_API","http://127.0.0.1:"+port);
        var process=builder.start();
        boolean ended=process.waitFor(120,java.util.concurrent.TimeUnit.SECONDS);
        if(!ended) process.destroyForcibly();
        String output=java.nio.file.Files.readString(log);
        if(output.length()>12000) output=output.substring(output.length()-12000);
        assertThat(ended).as(output).isTrue();
        assertThat(process.exitValue()).as(output).isZero();
        System.out.println(output);
    }

    private java.sql.Connection connection(String user,String password) throws java.sql.SQLException {
        return java.sql.DriverManager.getConnection(POSTGRES.getJdbcUrl(),user,password);
    }
    private tools.jackson.databind.JsonNode account(String prefix) throws Exception {
        return post("auth/register",null,"{\"email\":\""+prefix+dev.ritmo.shared.Json.id()+"@example.test\",\"password\":\"fixture-password\",\"displayName\":\"Pessoa\",\"deviceId\":\"01996300-0000-7000-8000-000000000002\"}",201);
    }
    @Test void databaseRolesEnforceReadWriteAndPreAuthenticationIsolation() throws Exception {
        var a=account("rlsa");var b=account("rlsb");String userA=a.path("accountId").asString(),userB=b.path("accountId").asString();
        try(var domain=connection("ritmo_domain","test-domain");var statement=domain.createStatement()) {
            try(var flags=statement.executeQuery("select rolsuper,rolbypassrls from pg_roles where rolname=current_user")) {
                assertThat(flags.next()).isTrue();assertThat(flags.getBoolean(1)).isFalse();assertThat(flags.getBoolean(2)).isFalse();
            }
            try(var result=statement.executeQuery("select count(*) from users")) {result.next();assertThat(result.getInt(1)).isZero();}
            org.assertj.core.api.Assertions.assertThatThrownBy(()->statement.executeQuery("select password_hash from users")).isInstanceOf(java.sql.SQLException.class);
            domain.setAutoCommit(false);
            try(var setting=domain.prepareStatement("select set_config('app.user_id',?,true)")) {setting.setString(1,userA);setting.execute();}
            try(var result=statement.executeQuery("select count(*) from users where id='"+userB+"'::uuid")) {result.next();assertThat(result.getInt(1)).isZero();}
            org.assertj.core.api.Assertions.assertThatThrownBy(()->statement.execute("insert into sync_account_state(user_id,feed_epoch) values('"+userB+"'::uuid,'"+dev.ritmo.shared.Json.id()+"'::uuid)"))
                .isInstanceOf(java.sql.SQLException.class).satisfies(e->assertThat(((java.sql.SQLException)e).getSQLState()).isEqualTo("42501"));
            domain.rollback();
            try(var result=statement.executeQuery("select count(*) from users")) {result.next();assertThat(result.getInt(1)).isZero();}
        }
        try(var identity=connection("ritmo_identity","test-identity");var statement=identity.createStatement()) {
            org.assertj.core.api.Assertions.assertThatThrownBy(()->statement.executeQuery("select * from habits")).isInstanceOf(java.sql.SQLException.class);
        }
    }
    private tools.jackson.databind.JsonNode operation(String id,long sequence,tools.jackson.databind.JsonNode command) {
        var op=dev.ritmo.shared.Json.object().put("operationId",id).put("deviceId","01996300-0000-7000-8000-000000000002").put("clientSequence",sequence).put("occurredAt","2026-09-25T13:00:00Z");
        op.set("dependsOn",dev.ritmo.shared.Json.array());op.set("command",command);return op;
    }
    private String batch(tools.jackson.databind.JsonNode operation) {
        var body=dev.ritmo.shared.Json.object();body.set("operations",dev.ritmo.shared.Json.array().add(operation));return body.toString();
    }
    private tools.jackson.databind.JsonNode createCommand(String habit) {
        return dev.ritmo.shared.Json.read("""
            {"type":"habit.create","habitId":"%s","title":"Caminhar","habitType":"binary","scheduleKind":"daily","startDayKey":"2026-09-25",
            "timeContext":{"timezone":"America/Sao_Paulo","dayStartHour":4},"iconKey":null,"colorToken":null,"sortOrder":0}
            """.formatted(habit));
    }
    @Test void aRequiredXpFailureRollsBackTheFactReceiptAndFeedAndCanBeRetried() throws Exception {
        var account=account("rollback");String user=account.path("accountId").asString(),token=account.path("accessToken").asString(),habit=dev.ritmo.shared.Json.id();
        post("sync/push",token,batch(operation(dev.ritmo.shared.Json.id(),1,createCommand(habit))),200);
        var mark=operation(dev.ritmo.shared.Json.id(),2,dev.ritmo.shared.Json.read("""
            {"type":"habit.mark","habitId":"%s","dayKey":"2026-09-25","timeContext":{"timezone":"America/Sao_Paulo","dayStartHour":4},"observedUndoIds":[]}
            """.formatted(habit)));
        try(var owner=connection(POSTGRES.getUsername(),POSTGRES.getPassword());var statement=owner.createStatement()) {
            statement.execute("CREATE FUNCTION test_fail_xp() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.user_id='"+user+"'::uuid THEN RAISE EXCEPTION 'test storage failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_fail_xp BEFORE INSERT ON xp_events FOR EACH ROW EXECUTE FUNCTION test_fail_xp()");
            try {post("sync/push",token,batch(mark),503);}
            finally {statement.execute("DROP TRIGGER test_fail_xp ON xp_events; DROP FUNCTION test_fail_xp()");}
        }
        var manifest=post("sync/snapshots",token,"{}",201);
        assertThat(manifest.path("highWaterRevision").asString()).isEqualTo("1");
        assertThat(manifest.path("entityCount").asInt()).isEqualTo(2);
        var retry=post("sync/push",token,batch(mark),200);
        assertThat(retry.at("/results/0/receipt/acceptedRevision").asString()).isEqualTo("2");
        assertThat(retry.at("/results/0/replayed").asBoolean()).isFalse();
        var replay=post("sync/push",token,batch(mark),200);
        assertThat(replay.at("/results/0/receipt/acceptedRevision").asString()).isEqualTo("2");
        assertThat(replay.at("/results/0/replayed").asBoolean()).isTrue();
    }

    @Test void foreignAccountReferencesAreRejectedByApiAndCompositeForeignKeys() throws Exception {
        var a=account("ownerA");var b=account("ownerB");String habit=dev.ritmo.shared.Json.id();
        post("sync/push",b.path("accessToken").asString(),batch(operation(dev.ritmo.shared.Json.id(),1,createCommand(habit))),200);
        var command=dev.ritmo.shared.Json.read("""
            {"type":"habit.mark","habitId":"%s","dayKey":"2026-09-25","timeContext":{"timezone":"America/Sao_Paulo","dayStartHour":4},"observedUndoIds":[]}
            """.formatted(habit));
        var result=post("sync/push",a.path("accessToken").asString(),batch(operation(dev.ritmo.shared.Json.id(),1,command)),200);
        assertThat(result.at("/results/0/receipt/error/code").asString()).isEqualTo("resource_inaccessible");
        try(var domain=connection("ritmo_domain","test-domain");var statement=domain.createStatement()) {
            domain.setAutoCommit(false);
            try(var setting=domain.prepareStatement("select set_config('app.user_id',?,true)")) {setting.setString(1,a.path("accountId").asString());setting.execute();}
            org.assertj.core.api.Assertions.assertThatThrownBy(()->statement.execute("insert into habit_day_states(user_id,id,habit_id,day_key,done,revision) values('"+a.path("accountId").asString()+"'::uuid,'"+dev.ritmo.shared.Json.id()+"'::uuid,'"+habit+"'::uuid,'2026-09-25',false,1)"))
                .isInstanceOf(java.sql.SQLException.class).satisfies(e->assertThat(((java.sql.SQLException)e).getSQLState()).isEqualTo("23503"));
            domain.rollback();
        }
    }
    @Test void retriesCannotReplaceAnAcceptedIntentAndRejectedParentsDoNotDeferForever() throws Exception {
        var session=account("retries");String token=session.path("accessToken").asString(),habit=dev.ritmo.shared.Json.id();
        String id=dev.ritmo.shared.Json.id();
        var create=operation(id,1,createCommand(habit));post("sync/push",token,batch(create),200);
        var changed=create.deepCopy();
        ((tools.jackson.databind.node.ObjectNode)changed.path("command")).put("title","Outro");
        var conflict=post("sync/push",token,batch(changed),200);
        assertThat(conflict.at("/results/0/receipt/error/code").asString()).isEqualTo("id_content_conflict");
        var repeat=post("sync/push",token,batch(create),200);
        assertThat(repeat.at("/results/0/replayed").asBoolean()).isTrue();
        assertThat(repeat.at("/results/0/receipt/acceptedRevision").asString()).isEqualTo("1");
        String duplicate=dev.ritmo.shared.Json.id();
        var rejected=post("sync/push",token,batch(operation(duplicate,2,createCommand(dev.ritmo.shared.Json.id()))),200);
        assertThat(rejected.at("/results/0/receipt/error/code").asString()).isEqualTo("title_unavailable");
        var dependent=(tools.jackson.databind.node.ObjectNode)operation(dev.ritmo.shared.Json.id(),3,createCommand(dev.ritmo.shared.Json.id()));
        dependent.set("dependsOn",dev.ritmo.shared.Json.array().add(duplicate));
        var response=post("sync/push",token,batch(dependent),200);
        assertThat(response.at("/results/0/receipt/error/code").asString()).isEqualTo("dependency_rejected");
    }
    @Test void aRevocationCapabilityOnlyRevokesItsOwnSessionAndIsRepeatable() throws Exception {
        var a=account("revoke-a");var b=account("revoke-b");
        String capability=a.path("revokeToken").asString();
        post("sync/snapshots",capability,"{}",401);
        String request="{\"revokeToken\":\""+capability+"\"}";
        post("auth/revoke",null,request,204);
        post("auth/revoke",null,request,204);
        post("auth/revoke",null,"{\"revokeToken\":\"unknown-capability-000000000000000000000000\"}",204);
        // Existing stateless access remains bounded by its original expiry.
        post("sync/snapshots",b.path("accessToken").asString(),"{}",201);
    }
    @Test void refreshIsSingleUseAndTheOriginalCapabilityRevokesTheRotatedFamily() throws Exception {
        var session=account("refresh");
        String original=session.path("refreshToken").asString();
        var next=post("auth/refresh",null,"{\"refreshToken\":\""+original+"\"}",200);
        assertThat(next.path("refreshToken").asString()).isNotEqualTo(original);
        assertThat(next.path("sessionId")).isEqualTo(session.path("sessionId"));
        assertThat(next.has("revokeToken")).isFalse();
        post("auth/refresh",null,"{\"refreshToken\":\""+original+"\"}",401);
        post("sync/snapshots",next.path("accessToken").asString(),"{}",201);
        post("auth/revoke",null,"{\"revokeToken\":\""+session.path("revokeToken").asString()+"\"}",204);
        post("auth/refresh",null,"{\"refreshToken\":\""+next.path("refreshToken").asString()+"\"}",401);
        post("auth/refresh",null,"{\"refreshToken\":\""+session.path("revokeToken").asString()+"\"}",401);
    }
    @Test void concurrentRefreshRequestsProduceExactlyOneReplacement() throws Exception {
        var session=account("parallel-refresh");
        var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/v1/auth/refresh"))
            .header("Content-Type","application/json").header("X-Ritmo-Protocol","m1.1").header("X-App-Version","0.1.0")
            .POST(HttpRequest.BodyPublishers.ofString("{\"refreshToken\":\""+session.path("refreshToken").asString()+"\"}")).build();
        try(var client=HttpClient.newHttpClient()) {
            var first=client.sendAsync(request,HttpResponse.BodyHandlers.ofString());
            var second=client.sendAsync(request,HttpResponse.BodyHandlers.ofString());
            assertThat(java.util.List.of(first.join().statusCode(),second.join().statusCode())).containsExactlyInAnyOrder(200,401);
        }
    }
    @Test void issuedAccessTokensCarryTheAccountPlanAndTimezoneForFifteenMinutes() throws Exception {
        var session=account("claims");
        var token=session.path("accessToken").asString();
        var claims=dev.ritmo.shared.Json.read(new String(java.util.Base64.getUrlDecoder().decode(token.split("\\.")[1]),java.nio.charset.StandardCharsets.UTF_8));
        assertThat(claims.path("sub")).isEqualTo(session.path("accountId"));
        assertThat(claims.path("plan").asString()).isEqualTo("free");
        assertThat(claims.path("tz").asString()).isEqualTo("UTC");
        assertThat(claims.path("exp").asLong()-claims.path("iat").asLong()).isEqualTo(900);
    }
}
