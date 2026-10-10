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
    static final com.icegreen.greenmail.util.GreenMail MAIL=new com.icegreen.greenmail.util.GreenMail(
        new com.icegreen.greenmail.util.ServerSetup(0,"127.0.0.1","smtp"));
    static {
        MAIL.start();
        POSTGRES.start();
        try (var connection=java.sql.DriverManager.getConnection(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword()); var statement=connection.createStatement()) {
            statement.execute("CREATE ROLE ritmo_domain LOGIN PASSWORD 'test-domain'; CREATE ROLE ritmo_identity LOGIN PASSWORD 'test-identity';");
        } catch(java.sql.SQLException e) { throw new ExceptionInInitializerError(e); }
    }
    @DynamicPropertySource static void database(DynamicPropertyRegistry properties) {
        properties.add("server.address",()->"127.0.0.1");
        properties.add("ritmo.sync-retention.enabled",()->false);
        for(String scope:java.util.List.of("api-ip","account","login","register","reset-request","reset-confirm","refresh","revoke"))
            properties.add("ritmo.rate-limits."+scope+".capacity",()->1000000);
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
        properties.add("spring.mail.host",()->"127.0.0.1");
        properties.add("spring.mail.port",()->MAIL.getSmtp().getPort());
        properties.add("spring.mail.properties.mail.smtp.auth",()->"false");
        properties.add("spring.mail.properties.mail.smtp.starttls.required",()->"false");
        properties.add("spring.mail.properties.mail.smtp.starttls.enable",()->"false");
        properties.add("ritmo.recovery.origin",()->"https://api.example.test");
        properties.add("ritmo.recovery.from",()->"no-reply@example.test");
    }
    @org.junit.jupiter.api.AfterAll static void stopMail() {MAIL.stop();}
    static final MutableClock RESET_CLOCK=new MutableClock();
    static class MutableClock extends java.time.Clock {
        private volatile java.time.Instant now=java.time.Instant.now();
        void advance(long seconds) {now=now.plusSeconds(seconds);}
        @Override public java.time.Instant instant() {return now;}
        @Override public java.time.ZoneId getZone() {return java.time.ZoneOffset.UTC;}
        @Override public java.time.Clock withZone(java.time.ZoneId zone) {return java.time.Clock.fixed(now,zone);}
    }
    @org.springframework.boot.test.context.TestConfiguration(proxyBeanMethods=false)
    static class TestTime {
        @org.springframework.context.annotation.Bean @org.springframework.context.annotation.Primary
        java.time.Clock resetClock() {return RESET_CLOCK;}
    }
    @org.junit.jupiter.api.BeforeEach void resetTime() {RESET_CLOCK.now=java.time.Instant.now();}
    @LocalServerPort int port;
    @org.springframework.beans.factory.annotation.Autowired org.springframework.mail.javamail.JavaMailSenderImpl smtp;
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

    private tools.jackson.databind.JsonNode getSync(String path,String token,int expected) throws Exception {
        var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/v1/sync/"+path))
            .header("X-Ritmo-Protocol","m1.1").header("X-App-Version","0.1.0")
            .header("Authorization","Bearer "+token).GET().build();
        var response=HttpClient.newHttpClient().send(request,HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(response.body()).isEqualTo(expected);
        return dev.ritmo.shared.Json.read(response.body());
    }
    @Test void aDeletionXpFailureRollsBackTombstoneGrantReceiptAndFeed() throws Exception {
        var session=account("deletion-rollback");String token=session.path("accessToken").asString(),user=session.path("accountId").asString(),habit=dev.ritmo.shared.Json.id();
        post("sync/push",token,batch(operation(dev.ritmo.shared.Json.id(),1,createCommand(habit))),200);
        var mark=dev.ritmo.shared.Json.object().put("type","habit.mark").put("habitId",habit).put("dayKey","2026-09-25");
        mark.set("timeContext",dev.ritmo.shared.Json.read("{\"timezone\":\"America/Sao_Paulo\",\"dayStartHour\":4}"));
        mark.set("observedUndoIds",dev.ritmo.shared.Json.array());
        post("sync/push",token,batch(operation(dev.ritmo.shared.Json.id(),2,mark)),200);
        var deletion=operation(dev.ritmo.shared.Json.id(),3,dev.ritmo.shared.Json.object().put("type","habit.delete").put("habitId",habit));
        try(var owner=connection(POSTGRES.getUsername(),POSTGRES.getPassword());var statement=owner.createStatement()) {
            statement.execute("""
                create function test_fail_deletion_transition() returns trigger language plpgsql as $$
                begin if new.user_id::text='%s' and new.kind='reverse' then raise exception 'fixture_deletion_failure'; end if; return new; end $$
                """.formatted(user));
            statement.execute("create trigger test_fail_deletion_transition before insert on xp_transitions for each row execute function test_fail_deletion_transition()");
            try {
                assertThat(post("sync/push",token,batch(deletion),503).at("/error/code").asString()).isEqualTo("temporarily_unavailable");
                var manifest=post("sync/snapshots",token,"{}",201);
                assertThat(manifest.path("highWaterRevision").asString()).isEqualTo("2");
                var page=getSync("snapshots/"+manifest.path("snapshotId").asString()+"?cursor="+manifest.path("firstPageCursor").asString(),token,200);
                var all=java.util.stream.StreamSupport.stream(page.path("entities").spliterator(),false).toList();
                assertThat(all.stream().filter(e->e.path("kind").asString().equals("tombstone")).count()).isZero();
                assertThat(all.stream().filter(e->e.path("kind").asString().equals("habit")).count()).isEqualTo(1);
                assertThat(all.stream().filter(e->e.path("kind").asString().equals("xpGrant")&&e.at("/value/active").asBoolean()).count()).isEqualTo(1);
                var query=dev.ritmo.shared.Json.object().put("snapshotId",manifest.path("snapshotId").asString());
                query.set("operationIds",dev.ritmo.shared.Json.array().add(deletion.path("operationId")));
                assertThat(post("sync/receipts",token,query.toString(),200).at("/results/0/status").asString()).isEqualTo("notProcessedAtH");
            } finally {
                statement.execute("drop trigger test_fail_deletion_transition on xp_transitions");
                statement.execute("drop function test_fail_deletion_transition()");
            }
        }
        assertThat(post("sync/push",token,batch(deletion),200).at("/results/0/receipt/status").asString()).isEqualTo("accepted");
    }

    @Test void anExpiredDeletionFeedKeepsItsIdAndOriginalReceiptsThroughSnapshot() throws Exception {
        RESET_CLOCK.now=java.time.Instant.parse("2026-09-30T12:00:00Z");
        var session=account("deletion-retention");String token=session.path("accessToken").asString(),user=session.path("accountId").asString();
        String habit=dev.ritmo.shared.Json.id();
        var initial=post("sync/snapshots",token,"{}",201);
        var first=getSync("snapshots/"+initial.path("snapshotId").asString()+"?cursor="+initial.path("firstPageCursor").asString(),token,200);
        String cursor=first.path("pullCursor").asString();
        var creation=operation(dev.ritmo.shared.Json.id(),1,createCommand(habit));
        post("sync/push",token,batch(creation),200);
        var deletion=operation(dev.ritmo.shared.Json.id(),2,dev.ritmo.shared.Json.object().put("type","habit.delete").put("habitId",habit));
        post("sync/push",token,batch(deletion),200);
        RESET_CLOCK.now=java.time.Instant.parse("2026-12-29T12:00:00Z"); // Exactly 90 days, inclusive.
        getSync("pull?cursor="+cursor,token,200);
        RESET_CLOCK.now=RESET_CLOCK.now.plusSeconds(1);
        assertThat(getSync("pull?cursor="+cursor,token,409).at("/error/code").asString()).isEqualTo("resync_required");
        // External fixture simulates removal of the expired feed; retain IDs, soft delete and receipts.
        try(var owner=connection(POSTGRES.getUsername(),POSTGRES.getPassword());
            var purge=owner.prepareStatement("delete from sync_changes where user_id=?::uuid")) {
            purge.setString(1,user);purge.executeUpdate();
        }
        var manifest=post("sync/snapshots",token,"{}",201);
        var page=getSync("snapshots/"+manifest.path("snapshotId").asString()+"?cursor="+manifest.path("firstPageCursor").asString(),token,200);
        assertThat(page.path("entities").size()).isEqualTo(2);
        assertThat(java.util.stream.StreamSupport.stream(page.path("entities").spliterator(),false).filter(e->e.path("kind").asString().equals("tombstone")).count()).isEqualTo(1);
        var replay=post("sync/push",token,batch(creation),200);
        assertThat(replay.at("/results/0/replayed").asBoolean()).isTrue();
        assertThat(replay.at("/results/0/receipt/acceptedRevision").asString()).isEqualTo("1");
        var retry=post("sync/push",token,batch(operation(dev.ritmo.shared.Json.id(),3,createCommand(habit))),200);
        assertThat(retry.at("/results/0/receipt/error/code").asString()).isEqualTo("id_content_conflict");
        var query=dev.ritmo.shared.Json.object().put("snapshotId",manifest.path("snapshotId").asString());
        query.set("operationIds",dev.ritmo.shared.Json.array().add(creation.path("operationId")));
        assertThat(post("sync/receipts",token,query.toString(),200).at("/results/0/acceptedRevision").asString()).isEqualTo("1");
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

    @Test void mobileLogicalDaysRemainStableThroughTheRealHttpApi() throws Exception {
        RESET_CLOCK.now=java.time.Instant.parse("2026-11-03T12:00:00Z");
        var log=java.nio.file.Path.of("build/time-integration.log");
        var builder=new ProcessBuilder("node","--import","tsx","--test","test/integration/time.test.ts")
            .directory(java.nio.file.Path.of("../app").toFile()).redirectErrorStream(true).redirectOutput(log.toFile());
        builder.environment().put("RITMO_TEST_API","http://127.0.0.1:"+port);
        builder.environment().put("RITMO_TEST_SERVER_TIME",RESET_CLOCK.instant().toString());
        var process=builder.start();
        boolean ended=process.waitFor(120,java.util.concurrent.TimeUnit.SECONDS);
        if(!ended) process.destroyForcibly();
        String output=java.nio.file.Files.readString(log);
        if(output.length()>12000) output=output.substring(output.length()-12000);
        assertThat(ended).as(output).isTrue();
        assertThat(process.exitValue()).as(output).isZero();
        System.out.println(output);
    }

    @Test void mobileDeletionsConvergeThroughTheRealHttpApi() throws Exception {
        RESET_CLOCK.now=java.time.Instant.parse("2026-09-30T12:00:00Z");
        var log=java.nio.file.Path.of("build/deletion-integration.log");
        var builder=new ProcessBuilder("node","--import","tsx","--test","test/integration/deletion.test.ts")
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
    @Test void recoveryRequestSendsAnHttpsLinkOnlyByEmailAndDoesNotChangeThePassword() throws Exception {
        String email="recovery-"+dev.ritmo.shared.Json.id()+"@example.test";
        post("auth/register",null,dev.ritmo.shared.Json.object().put("email",email).put("password","fixture-password")
            .put("displayName","Pessoa").put("deviceId","01996300-0000-7000-8000-000000000002").toString(),201);
        var result=post("auth/password-reset/request",null,dev.ritmo.shared.Json.object().put("email",email).toString(),202);
        assertThat(result.size()).isZero();
        String link=resetLink(email);
        var uri=URI.create(link);
        assertThat(uri.getScheme()).isEqualTo("https");
        assertThat(uri.getHost()).isEqualTo("api.example.test");
        assertThat(uri.getPath()).isEqualTo("/password-reset");
        assertThat(uri.getQuery()).isNull();
        assertThat(uri.getFragment()).matches("token=[A-Za-z0-9_-]{43}");
        post("auth/login",null,dev.ritmo.shared.Json.object().put("email",email).put("password","fixture-password")
            .put("deviceId","01996300-0000-7000-8000-000000000002").toString(),200);
    }
    private String resetLink(String email) throws Exception {return resetLink(email,0);}
    private String resetLink(String email,int index) throws Exception {
        org.awaitility.Awaitility.await().atMost(java.time.Duration.ofSeconds(10)).until(()->MAIL.getReceivedMessagesForDomain(email).length>index);
        var message=MAIL.getReceivedMessagesForDomain(email)[index];
        assertThat(message.getFrom()[0].toString()).isEqualTo("no-reply@example.test");
        assertThat(message.getAllRecipients()).hasSize(1);
        assertThat(message.getAllRecipients()[0].toString()).isEqualTo(email);
        try(var body=message.getInputStream()) {
            String text=new String(body.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8);
            var match=java.util.regex.Pattern.compile("https://[^\\s]+/password-reset#token=[A-Za-z0-9_-]+").matcher(text);
            assertThat(match.find()).as("reset link received through SMTP").isTrue();return match.group();
        }
    }
    @Test void aResetLinkChangesThePasswordOnceAndRevokesOnlyThatAccountsSessions() throws Exception {
        String email="confirm-"+dev.ritmo.shared.Json.id()+"@example.test";
        var login=dev.ritmo.shared.Json.object().put("email",email).put("password","fixture-password")
            .put("deviceId","01996300-0000-7000-8000-000000000002");
        var registration=login.deepCopy().put("displayName","Pessoa");
        var first=post("auth/register",null,registration.toString(),201);
        var second=post("auth/login",null,login.toString(),200);
        var other=account("unaffected");
        post("auth/password-reset/request",null,dev.ritmo.shared.Json.object().put("email",email).toString(),202);
        String token=URI.create(resetLink(email)).getFragment().substring(6);
        String confirm=dev.ritmo.shared.Json.object().put("resetToken",token).put("newPassword"," changed-fixture-password ").toString();
        post("auth/password-reset/confirm",null,confirm,204);
        post("auth/password-reset/confirm",null,confirm,401);
        post("auth/login",null,login.toString(),401);
        post("auth/login",null,login.put("password","changed-fixture-password").toString(),401);
        post("auth/login",null,login.put("password"," changed-fixture-password ").toString(),200);
        for(var session:java.util.List.of(first,second)) post("auth/refresh",null,
            dev.ritmo.shared.Json.object().put("refreshToken",session.path("refreshToken").asString()).toString(),401);
        post("auth/refresh",null,dev.ritmo.shared.Json.object().put("refreshToken",other.path("refreshToken").asString()).toString(),200);
        // Reset follows the same bounded stateless-access window as logout.
        post("sync/snapshots",first.path("accessToken").asString(),"{}",201);
    }
    @Test void aResetIsValidBeforeOneHourAndInvalidAtTheExactExpiration() throws Exception {
        for(long age:java.util.List.of(3599L,3600L)) {
            String email="expires-"+dev.ritmo.shared.Json.id()+"@example.test";
            var login=dev.ritmo.shared.Json.object().put("email",email).put("password","fixture-password")
                .put("deviceId","01996300-0000-7000-8000-000000000002");
            post("auth/register",null,login.deepCopy().put("displayName","Pessoa").toString(),201);
            post("auth/password-reset/request",null,dev.ritmo.shared.Json.object().put("email",email).toString(),202);
            String token=URI.create(resetLink(email)).getFragment().substring(6);
            RESET_CLOCK.advance(age);
            var result=post("auth/password-reset/confirm",null,dev.ritmo.shared.Json.object().put("resetToken",token)
                .put("newPassword","changed-fixture-password").toString(),age==3599?204:401);
            if(age==3600) {
                assertThat(result.at("/error/code").asString()).isEqualTo("reset_invalid");
                post("auth/login",null,login.toString(),200);
            }
        }
    }
    @Test void resetRequestsAreUniformAndNormalizeTheEmailWithoutProviderAliases() throws Exception {
        String email="case."+dev.ritmo.shared.Json.id()+"+tag@example.test";
        post("auth/register",null,dev.ritmo.shared.Json.object().put("email",email).put("password","fixture-password")
            .put("displayName","Pessoa").put("deviceId","01996300-0000-7000-8000-000000000002").toString(),201);
        String unknown="absent-"+dev.ritmo.shared.Json.id()+"@example.test";
        var absent=post("auth/password-reset/request",null,dev.ritmo.shared.Json.object().put("email",unknown).toString(),202);
        var present=post("auth/password-reset/request",null,dev.ritmo.shared.Json.object().put("email","  "+email.toUpperCase(java.util.Locale.ROOT)+"  ").toString(),202);
        assertThat(absent).isEqualTo(present);
        resetLink(email); // The single worker processed the absent request before this message.
        assertThat(MAIL.getReceivedMessagesForDomain(unknown)).isEmpty();
        post("auth/password-reset/request",null,"{\"email\":\"bad-address\"}",400);
    }

    @Test void successfulResetInvalidatesOtherLinksButNewRequestsDoNot() throws Exception {
        String email="links-"+dev.ritmo.shared.Json.id()+"@example.test";
        post("auth/register",null,dev.ritmo.shared.Json.object().put("email",email).put("password","fixture-password")
            .put("displayName","Pessoa").put("deviceId","01996300-0000-7000-8000-000000000002").toString(),201);
        String request=dev.ritmo.shared.Json.object().put("email",email).toString();
        post("auth/password-reset/request",null,request,202);
        String first=URI.create(resetLink(email,0)).getFragment().substring(6);
        post("auth/password-reset/request",null,request,202);
        String second=URI.create(resetLink(email,1)).getFragment().substring(6);
        assertThat(first).isNotEqualTo(second);
        post("auth/password-reset/confirm",null,dev.ritmo.shared.Json.object().put("resetToken",first)
            .put("newPassword","changed-fixture-password").toString(),204);
        var denied=post("auth/password-reset/confirm",null,dev.ritmo.shared.Json.object().put("resetToken",second)
            .put("newPassword","another-fixture-password").toString(),401);
        assertThat(denied.at("/error/code").asString()).isEqualTo("reset_invalid");
        // A fresh request after the successful reset remains usable.
        post("auth/password-reset/request",null,request,202);
        String fresh=URI.create(resetLink(email,2)).getFragment().substring(6);
        post("auth/password-reset/confirm",null,dev.ritmo.shared.Json.object().put("resetToken",fresh)
            .put("newPassword","another-fixture-password").toString(),204);
    }

    @Test void concurrentConfirmationsConsumeTheResetExactlyOnce() throws Exception {
        String email="parallel-reset-"+dev.ritmo.shared.Json.id()+"@example.test";
        post("auth/register",null,dev.ritmo.shared.Json.object().put("email",email).put("password","fixture-password")
            .put("displayName","Pessoa").put("deviceId","01996300-0000-7000-8000-000000000002").toString(),201);
        post("auth/password-reset/request",null,dev.ritmo.shared.Json.object().put("email",email).toString(),202);
        String token=URI.create(resetLink(email)).getFragment().substring(6);
        var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/v1/auth/password-reset/confirm"))
            .header("Content-Type","application/json").header("X-Ritmo-Protocol","m1.1").header("X-App-Version","0.1.0")
            .POST(HttpRequest.BodyPublishers.ofString(dev.ritmo.shared.Json.object().put("resetToken",token)
                .put("newPassword","changed-fixture-password").toString())).build();
        try(var client=HttpClient.newHttpClient()) {
            var first=client.sendAsync(request,HttpResponse.BodyHandlers.ofString());
            var second=client.sendAsync(request,HttpResponse.BodyHandlers.ofString());
            assertThat(java.util.List.of(first.join().statusCode(),second.join().statusCode())).containsExactlyInAnyOrder(204,401);
        }
    }

    @Test void failedRevocationRollsBackPasswordAndTokenConsumptionSoTheResetCanBeRetried() throws Exception {
        String email="reset-rollback-"+dev.ritmo.shared.Json.id()+"@example.test";
        var login=dev.ritmo.shared.Json.object().put("email",email).put("password","fixture-password")
            .put("deviceId","01996300-0000-7000-8000-000000000002");
        var session=post("auth/register",null,login.deepCopy().put("displayName","Pessoa").toString(),201);
        post("auth/password-reset/request",null,dev.ritmo.shared.Json.object().put("email",email).toString(),202);
        String token=URI.create(resetLink(email)).getFragment().substring(6);
        String confirm=dev.ritmo.shared.Json.object().put("resetToken",token).put("newPassword","changed-fixture-password").toString();
        try(var owner=connection(POSTGRES.getUsername(),POSTGRES.getPassword());var statement=owner.createStatement()) {
            statement.execute("CREATE FUNCTION test_fail_reset() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.user_id='"+session.path("accountId").asString()+"'::uuid AND NEW.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'test storage failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_fail_reset BEFORE UPDATE ON identity_refresh_tokens FOR EACH ROW EXECUTE FUNCTION test_fail_reset()");
            try {
                var failed=post("auth/password-reset/confirm",null,confirm,503);
                assertThat(failed.at("/error/code").asString()).isEqualTo("temporarily_unavailable");
            } finally {statement.execute("DROP TRIGGER test_fail_reset ON identity_refresh_tokens; DROP FUNCTION test_fail_reset()");}
        }
        post("auth/login",null,login.toString(),200);
        var continued=post("auth/refresh",null,dev.ritmo.shared.Json.object().put("refreshToken",session.path("refreshToken").asString()).toString(),200);
        post("auth/password-reset/confirm",null,confirm,204);
        post("auth/login",null,login.toString(),401);
        post("auth/login",null,login.put("password","changed-fixture-password").toString(),200);
        post("auth/refresh",null,dev.ritmo.shared.Json.object().put("refreshToken",continued.path("refreshToken").asString()).toString(),401);
    }

    @Test void smtpFailureKeepsThePublicResponseUniformAndLeavesPasswordAndSessionUsable() throws Exception {
        String email="mail-failure-"+dev.ritmo.shared.Json.id()+"@example.test";
        var login=dev.ritmo.shared.Json.object().put("email",email).put("password","fixture-password")
            .put("deviceId","01996300-0000-7000-8000-000000000002");
        var session=post("auth/register",null,login.deepCopy().put("displayName","Pessoa").toString(),201);
        int originalPort=smtp.getPort();
        // External SMTP boundary: a local server refuses delivery before accepting any message.
        try(var refused=new java.net.ServerSocket(0,1,java.net.InetAddress.getByName("127.0.0.1"))) {
            refused.setSoTimeout(10000);smtp.setPort(refused.getLocalPort());
            var connection=java.util.concurrent.CompletableFuture.runAsync(()->{
                try(var socket=refused.accept()) {
                    socket.getOutputStream().write("421 local test service unavailable\r\n".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
                    socket.getOutputStream().flush();
                } catch(java.io.IOException e) {throw new java.io.UncheckedIOException(e);}
            });
            try {
                var known=post("auth/password-reset/request",null,dev.ritmo.shared.Json.object().put("email",email).toString(),202);
                var unknown=post("auth/password-reset/request",null,dev.ritmo.shared.Json.object().put("email","absent-"+dev.ritmo.shared.Json.id()+"@example.test").toString(),202);
                assertThat(known).isEqualTo(unknown);
                connection.get(10,java.util.concurrent.TimeUnit.SECONDS);
            } finally {smtp.setPort(originalPort);}
        }
        post("auth/login",null,login.toString(),200);
        post("auth/refresh",null,dev.ritmo.shared.Json.object().put("refreshToken",session.path("refreshToken").asString()).toString(),200);
        assertThat(MAIL.getReceivedMessagesForDomain(email)).isEmpty();
        // A new request after delivery recovers can issue a usable link.
        post("auth/password-reset/request",null,dev.ritmo.shared.Json.object().put("email",email).toString(),202);
        post("auth/password-reset/confirm",null,dev.ritmo.shared.Json.object().put("resetToken",URI.create(resetLink(email)).getFragment().substring(6))
            .put("newPassword","changed-fixture-password").toString(),204);
    }

    @Test void mobileRecoveryKeepsPendingWorkThroughReauthenticationAndSync() throws Exception {
        String email="mobile-reset-"+dev.ritmo.shared.Json.id()+"@example.test";
        post("auth/register",null,dev.ritmo.shared.Json.object().put("email",email).put("password","fixture-password")
            .put("displayName","Pessoa").put("deviceId","01996300-0000-7000-8000-000000000002").toString(),201);
        post("auth/password-reset/request",null,dev.ritmo.shared.Json.object().put("email",email).toString(),202);
        var log=java.nio.file.Path.of("build/mobile-recovery.log");
        var builder=new ProcessBuilder("node","--import","tsx","--test","test/integration/recovery.test.ts")
            .directory(java.nio.file.Path.of("../app").toFile()).redirectErrorStream(true).redirectOutput(log.toFile());
        builder.environment().put("RITMO_TEST_API","http://127.0.0.1:"+port);
        builder.environment().put("RITMO_RESET_EMAIL",email);
        builder.environment().put("RITMO_RESET_LINK",resetLink(email));
        var process=builder.start();
        boolean ended=process.waitFor(120,java.util.concurrent.TimeUnit.SECONDS);
        if(!ended) process.destroyForcibly();
        String output=java.nio.file.Files.readString(log);
        if(output.length()>12000) output=output.substring(output.length()-12000);
        assertThat(ended).as(output).isTrue();
        assertThat(process.exitValue()).as(output).isZero();
        System.out.println(output);
    }

    @Test void invalidPasswordsDoNotConsumeTheLinkAndUnicodeLimitsCountCodePoints() throws Exception {
        String email="password-bounds-"+dev.ritmo.shared.Json.id()+"@example.test";
        var login=dev.ritmo.shared.Json.object().put("email",email).put("password","fixture-password")
            .put("deviceId","01996300-0000-7000-8000-000000000002");
        post("auth/register",null,login.deepCopy().put("displayName","Pessoa").toString(),201);
        post("auth/password-reset/request",null,dev.ritmo.shared.Json.object().put("email",email).toString(),202);
        String token=URI.create(resetLink(email)).getFragment().substring(6);
        for(String invalid:java.util.List.of("1234567","😀".repeat(129)))
            post("auth/password-reset/confirm",null,dev.ritmo.shared.Json.object().put("resetToken",token).put("newPassword",invalid).toString(),400);
        for(String escaped:java.util.List.of("\\ud800","\\udfff")) {
            String invalid="{\"resetToken\":\""+token+"\",\"newPassword\":\"1234567"+escaped+"\"}";
            post("auth/password-reset/confirm",null,invalid,400);
        }
        var missing=post("auth/password-reset/confirm",null,dev.ritmo.shared.Json.object().put("resetToken","unknown-fixture-token-0000000000000000000000")
            .put("newPassword","changed-fixture-password").toString(),401);
        assertThat(missing.at("/error/code").asString()).isEqualTo("reset_invalid");
        String password="😀".repeat(8);
        post("auth/password-reset/confirm",null,dev.ritmo.shared.Json.object().put("resetToken",token).put("newPassword",password).toString(),204);
        post("auth/login",null,login.put("password",password).toString(),200);
    }
    @Test void automaticSyncConvergesAfterLostAckAndFlushesOfflineRevocation() throws Exception {
        var log=java.nio.file.Path.of("build/mobile-scheduler.log");
        var builder=new ProcessBuilder("node","--import","tsx","--test","test/integration/scheduler.test.ts")
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
    @Test void cyclicDependenciesAreRejectedWithRecoverableReferencesInsteadOfDeferredForever() throws Exception {
        var session=account("cycles");String token=session.path("accessToken").asString();
        String a=dev.ritmo.shared.Json.id(),b=dev.ritmo.shared.Json.id(),c=dev.ritmo.shared.Json.id();
        var first=operation(a,1,createCommand(dev.ritmo.shared.Json.id()));
        var second=operation(b,2,createCommand(dev.ritmo.shared.Json.id()));
        var child=operation(c,3,createCommand(dev.ritmo.shared.Json.id()));
        ((tools.jackson.databind.node.ObjectNode)first).set("dependsOn",dev.ritmo.shared.Json.array().add(b));
        ((tools.jackson.databind.node.ObjectNode)second).set("dependsOn",dev.ritmo.shared.Json.array().add(a));
        ((tools.jackson.databind.node.ObjectNode)child).set("dependsOn",dev.ritmo.shared.Json.array().add(a));
        var body=dev.ritmo.shared.Json.object();body.set("operations",dev.ritmo.shared.Json.array().add(child).add(first).add(second));
        var response=post("sync/push",token,body.toString(),200);
        assertThat(response.at("/results/0/receipt/error/code").asString()).isEqualTo("dependency_rejected");
        assertThat(response.at("/results/0/receipt/error/dependencyIds/0").asString()).isEqualTo(a);
        assertThat(response.at("/results/1/receipt/error/code").asString()).isEqualTo("dependency_cycle");
        assertThat(response.at("/results/2/receipt/error/code").asString()).isEqualTo("dependency_cycle");
        var replay=post("sync/push",token,body.toString(),200);
        for(int i=0;i<3;i++) {
            assertThat(replay.at("/results/"+i+"/replayed").asBoolean()).isTrue();
            assertThat(replay.at("/results/"+i+"/receipt")).isEqualTo(response.at("/results/"+i+"/receipt"));
        }
    }

    @Test void mobileRecoversRejectedChainsThroughTheRealHttpApi() throws Exception {
        var log=java.nio.file.Path.of("build/mobile-rejections.log");
        var builder=new ProcessBuilder("node","--import","tsx","--test","test/integration/rejections.test.ts")
            .directory(java.nio.file.Path.of("../app").toFile()).redirectErrorStream(true).redirectOutput(log.toFile());
        builder.environment().put("RITMO_TEST_API","http://127.0.0.1:"+port);
        var process=builder.start();
        boolean ended=process.waitFor(120,java.util.concurrent.TimeUnit.SECONDS);
        if(!ended) process.destroyForcibly();
        String output=java.nio.file.Files.readString(log);
        if(output.length()>12000) output=output.substring(output.length()-12000);
        assertThat(ended).as(output).isTrue();assertThat(process.exitValue()).as(output).isZero();
        System.out.println(output);
    }


    @Test void historicalReceiptProofIsEnrichedWithoutRewritingHistoryOrLeakingAccounts() throws Exception {
        var session=account("legacyProof");String user=session.path("accountId").asString(),token=session.path("accessToken").asString();
        var before=post("sync/snapshots",token,"{}",201);
        var page=getSync("snapshots/"+before.path("snapshotId").asString()+"?cursor="+before.path("firstPageCursor").asString(),token,200);
        var operation=operation(dev.ritmo.shared.Json.id(),1,createCommand(dev.ritmo.shared.Json.id()));
        var accepted=post("sync/push",token,batch(operation),200).at("/results/0/receipt");
        String hash=dev.ritmo.shared.Json.canonicalHash(operation);
        assertThat(accepted.path("operationHash").asString()).isEqualTo(hash);
        // External storage fixture: represent JSON written by the previous API version.
        try(var owner=connection(POSTGRES.getUsername(),POSTGRES.getPassword())) {
            try(var update=owner.prepareStatement("update sync_operation_receipts set result=result-'operationHash' where user_id=?::uuid")) {
                update.setString(1,user);update.executeUpdate();
            }
            try(var update=owner.prepareStatement("update sync_changes set envelope=jsonb_set(envelope,'{operationResults}',jsonb_build_array((envelope->'operationResults'->0)-'operationHash')) where user_id=?::uuid")) {
                update.setString(1,user);update.executeUpdate();
            }
        }
        var replay=post("sync/push",token,batch(operation),200).at("/results/0/receipt");
        assertThat(replay).isEqualTo(accepted);
        var pulled=getSync("pull?cursor="+page.path("pullCursor").asString(),token,200);
        assertThat(pulled.at("/changes/0/operationResults/0")).isEqualTo(accepted);
        var snapshot=post("sync/snapshots",token,"{}",201);
        var queryBody=dev.ritmo.shared.Json.object().put("snapshotId",snapshot.path("snapshotId").asString());
        queryBody.set("operationIds",dev.ritmo.shared.Json.array().add(operation.path("operationId").asString()));String query=queryBody.toString();
        assertThat(post("sync/receipts",token,query,200).at("/results/0")).isEqualTo(accepted);
        var foreign=account("legacyProofB");String other=foreign.path("accessToken").asString();
        var otherSnapshot=post("sync/snapshots",other,"{}",201);
        String otherQuery=query.replace(snapshot.path("snapshotId").asString(),otherSnapshot.path("snapshotId").asString());
        var inaccessible=post("sync/receipts",other,otherQuery,200).at("/results/0");
        assertThat(inaccessible.path("status").asString()).isEqualTo("notProcessedAtH");
        assertThat(inaccessible.has("operationHash")).isFalse();
        try(var owner=connection(POSTGRES.getUsername(),POSTGRES.getPassword());var statement=owner.prepareStatement(
            "select jsonb_exists(result,'operationHash'), (select jsonb_exists(envelope->'operationResults'->0,'operationHash') from sync_changes where user_id=?::uuid limit 1) from sync_operation_receipts where user_id=?::uuid")) {
            statement.setString(1,user);statement.setString(2,user);
            try(var result=statement.executeQuery()) {assertThat(result.next()).isTrue();assertThat(result.getBoolean(1)).isFalse();assertThat(result.getBoolean(2)).isFalse();}
        }
    }

    @Test void mobilePreservesConflictingIdentityThroughTheRealHttpApi() throws Exception {
        var log=java.nio.file.Path.of("build/mobile-identity-receipts.log");
        var builder=new ProcessBuilder("node","--import","tsx","--test","test/integration/identity-receipts.test.ts")
            .directory(java.nio.file.Path.of("../app").toFile()).redirectErrorStream(true).redirectOutput(log.toFile());
        builder.environment().put("RITMO_TEST_API","http://127.0.0.1:"+port);
        var process=builder.start();
        boolean ended=process.waitFor(120,java.util.concurrent.TimeUnit.SECONDS);
        if(!ended) process.destroyForcibly();
        String output=java.nio.file.Files.readString(log);
        if(output.length()>12000) output=output.substring(output.length()-12000);
        assertThat(ended).as(output).isTrue();assertThat(process.exitValue()).as(output).isZero();
        System.out.println(output);
    }

    @Test void overlappingCyclesClassifyEveryMemberOfTheCycle() throws Exception {
        String token=account("overlapping").path("accessToken").asString();
        String a=dev.ritmo.shared.Json.id(),b=dev.ritmo.shared.Json.id(),c=dev.ritmo.shared.Json.id();
        var first=(tools.jackson.databind.node.ObjectNode)operation(a,1,createCommand(dev.ritmo.shared.Json.id()));
        var second=(tools.jackson.databind.node.ObjectNode)operation(b,2,createCommand(dev.ritmo.shared.Json.id()));
        var third=(tools.jackson.databind.node.ObjectNode)operation(c,3,createCommand(dev.ritmo.shared.Json.id()));
        first.set("dependsOn",dev.ritmo.shared.Json.array().add(b).add(c));second.set("dependsOn",dev.ritmo.shared.Json.array().add(a));
        third.set("dependsOn",dev.ritmo.shared.Json.array().add(b));
        var body=dev.ritmo.shared.Json.object();body.set("operations",dev.ritmo.shared.Json.array().add(first).add(second).add(third));
        var response=post("sync/push",token,body.toString(),200);
        for(int i=0;i<3;i++) assertThat(response.at("/results/"+i+"/receipt/error/code").asString()).isEqualTo("dependency_cycle");
    }

    @Test void dependenciesAreOrderedWithinTheBatchAndChangedReplaysDoNotRedefineTheGraph() throws Exception {
        String token=account("ordering").path("accessToken").asString(),habit=dev.ritmo.shared.Json.id(),a=dev.ritmo.shared.Json.id(),b=dev.ritmo.shared.Json.id();
        var create=(tools.jackson.databind.node.ObjectNode)operation(a,1,createCommand(habit));
        var mark=(tools.jackson.databind.node.ObjectNode)operation(b,2,dev.ritmo.shared.Json.read("""
            {"type":"habit.mark","habitId":"%s","dayKey":"2026-09-25","timeContext":{"timezone":"America/Sao_Paulo","dayStartHour":4},"observedUndoIds":[]}
            """.formatted(habit)));
        mark.set("dependsOn",dev.ritmo.shared.Json.array().add(a));
        var body=dev.ritmo.shared.Json.object();body.set("operations",dev.ritmo.shared.Json.array().add(mark).add(create));
        var response=post("sync/push",token,body.toString(),200);
        assertThat(response.at("/results/0/receipt/acceptedRevision").asString()).isEqualTo("2");
        assertThat(response.at("/results/1/receipt/acceptedRevision").asString()).isEqualTo("1");
        String c=dev.ritmo.shared.Json.id();
        var edit=(tools.jackson.databind.node.ObjectNode)operation(c,3,dev.ritmo.shared.Json.read("""
            {"type":"habit.patchMetadata","habitId":"%s","patch":{"title":"Caminhar cedo"}}
            """.formatted(habit)));
        edit.set("dependsOn",dev.ritmo.shared.Json.array().add(a));create.set("dependsOn",dev.ritmo.shared.Json.array().add(c));
        body.set("operations",dev.ritmo.shared.Json.array().add(edit).add(create));response=post("sync/push",token,body.toString(),200);
        assertThat(response.at("/results/0/status").asString()).isEqualTo("deferred");
        assertThat(response.at("/results/0/missingDependencyIds/0").asString()).isEqualTo(a);
        assertThat(response.at("/results/1/receipt/error/identityConflict/kind").asString()).isEqualTo("operation");
        var replay=post("sync/push",token,batch(operation(a,1,createCommand(habit))),200);
        assertThat(replay.at("/results/0/receipt/acceptedRevision").asString()).isEqualTo("1");
        assertThat(replay.at("/results/0/replayed").asBoolean()).isTrue();
    }

    @Test void paginatedSnapshotsRecoverThroughTheRealHttpApi() throws Exception {
        var log=java.nio.file.Path.of("build/snapshot-integration.log");
        var builder=new ProcessBuilder("node","--import","tsx","--test","test/integration/snapshots.test.ts")
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

    @Test void expiredSnapshotsRefuseBothPagesAndReceiptClassification() throws Exception {
        var account=account("snapshot-expiry");
        String user=account.path("accountId").asString(),token=account.path("accessToken").asString();
        var snapshot=post("sync/snapshots",token,"{}",201);
        String snapshotId=snapshot.path("snapshotId").asString();
        // Advance only this fixture's expiry; no sleep and no changes to other accounts' snapshots.
        try(var owner=connection(POSTGRES.getUsername(),POSTGRES.getPassword());
            var expire=owner.prepareStatement("update sync_snapshots set expires_at=now()-interval '1 second' where user_id=?::uuid and id=?::uuid")) {
            expire.setString(1,user);expire.setString(2,snapshotId);expire.executeUpdate();
        }
        String cursor=java.net.URLEncoder.encode(snapshot.path("firstPageCursor").asString(),java.nio.charset.StandardCharsets.UTF_8);
        var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/v1/sync/snapshots/"+snapshotId+"?cursor="+cursor))
            .header("Authorization","Bearer "+token).header("X-Ritmo-Protocol","m1.1").header("X-App-Version","0.1.0").GET().build();
        var page=HttpClient.newHttpClient().send(request,HttpResponse.BodyHandlers.ofString());
        assertThat(page.statusCode()).isEqualTo(410);
        assertThat(dev.ritmo.shared.Json.read(page.body()).at("/error/code").asString()).isEqualTo("snapshot_expired");
        var query=dev.ritmo.shared.Json.object().put("snapshotId",snapshotId);
        query.set("operationIds",dev.ritmo.shared.Json.array().add(dev.ritmo.shared.Json.id()));
        assertThat(post("sync/receipts",token,query.toString(),410).at("/error/code").asString()).isEqualTo("snapshot_expired");
        assertThat(post("sync/snapshots",token,"{}",201).path("snapshotId").asString()).isNotEqualTo(snapshotId);
    }

    private int compatibilityStatus(String version,String protocol) throws Exception {
        var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/v1/sync/pull"))
            .header("X-App-Version",version).header("X-Ritmo-Protocol",protocol).GET().build();
        return HttpClient.newHttpClient().send(request,HttpResponse.BodyHandlers.ofString()).statusCode();
    }
    @Test void minimumVersionIsReadFromConfigurationAndComparedNumericallyBeforeAuthentication() throws Exception {
        var account=account("compatibility");String token=account.path("accessToken").asString();
        var intent=operation(dev.ritmo.shared.Json.id(),1,createCommand(dev.ritmo.shared.Json.id()));
        try(var owner=connection(POSTGRES.getUsername(),POSTGRES.getPassword());var statement=owner.createStatement()) {
            try {
                statement.execute("update app_compatibility set min_supported_version='0.10.0' where singleton");
                for(String version:java.util.List.of("0.9.99","0.10.0-rc.1","0.10.0-rc.1+build","00.10.0","0.10.0-01","0.10.0+","0.10.0.1","0.10.0+"+"a".repeat(58)))
                    assertThat(compatibilityStatus(version,"m1.1")).as(version).isEqualTo(426);
                for(String version:java.util.List.of("0.10.0","0.10.0+build.123","0.11.0-rc.1+build","1.0.0","0.10.0+"+"a".repeat(57)))
                    assertThat(compatibilityStatus(version,"m1.1")).as(version).isEqualTo(401);
                assertThat(compatibilityStatus("1.0.0","future")).isEqualTo(426);
                post("sync/push",token,batch(intent),426);
            } finally {statement.execute("update app_compatibility set min_supported_version='0.1.0' where singleton");}
        }
        var accepted=post("sync/push",token,batch(intent),200);
        assertThat(accepted.at("/results/0/receipt/acceptedRevision").asString()).isEqualTo("1");
        assertThat(accepted.at("/results/0/replayed").asBoolean()).isFalse();
    }

    @Test void runtimeRolesCannotChangeCompatibilityAndMissingConfigurationIsUnavailable() throws Exception {
        try(var domain=connection("ritmo_domain","test-domain");var statement=domain.createStatement()) {
            try(var row=statement.executeQuery("select min_supported_version from app_compatibility where singleton")) {
                assertThat(row.next()).isTrue();assertThat(row.getString(1)).isEqualTo("0.1.0");
            }
            org.assertj.core.api.Assertions.assertThatThrownBy(()->statement.execute("update app_compatibility set min_supported_version='0.0.0' where singleton"))
                .isInstanceOf(java.sql.SQLException.class).satisfies(e->assertThat(((java.sql.SQLException)e).getSQLState()).isEqualTo("42501"));
        }
        try(var identity=connection("ritmo_identity","test-identity");var statement=identity.createStatement()) {
            org.assertj.core.api.Assertions.assertThatThrownBy(()->statement.execute("update app_compatibility set min_supported_version='0.0.0' where singleton"))
                .isInstanceOf(java.sql.SQLException.class).satisfies(e->assertThat(((java.sql.SQLException)e).getSQLState()).isEqualTo("42501"));
        }
        try(var owner=connection(POSTGRES.getUsername(),POSTGRES.getPassword());var statement=owner.createStatement()) {
            try {
                statement.execute("delete from app_compatibility where singleton");
                assertThat(compatibilityStatus("0.1.0","m1.1")).isEqualTo(503);
            } finally {statement.execute("insert into app_compatibility(singleton,min_supported_version) values(true,'0.1.0') on conflict(singleton) do update set min_supported_version=excluded.min_supported_version");}
            try {
                statement.execute("revoke select on app_compatibility from ritmo_domain");
                assertThat(compatibilityStatus("0.1.0","m1.1")).isEqualTo(503);
            } finally {statement.execute("grant select on app_compatibility to ritmo_domain");}
        }
    }

    @Test void obsoleteMobileBuildPreservesWorkAndRecoversThroughTheRealHttpApi() throws Exception {
        var log=java.nio.file.Path.of("build/compatibility-integration.log");
        var builder=new ProcessBuilder("node","--import","tsx","--test","test/integration/compatibility.test.ts")
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

    @Test
    @org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable(named="RITMO_ANDROID_SERIAL",matches="emulator-[0-9]+")
    void androidRuntimeSynchronizesThroughNativeStorageAndHttp() throws Exception {
        var log=java.nio.file.Path.of("build/android-http-integration.log");
        var builder=new ProcessBuilder("node","--import","tsx","--test","test/integration/android-http.test.ts")
            .directory(java.nio.file.Path.of("../app").toFile()).redirectErrorStream(true).redirectOutput(log.toFile());
        builder.environment().put("RITMO_TEST_API","http://127.0.0.1:"+port);
        var process=builder.start();
        boolean ended=process.waitFor(240,java.util.concurrent.TimeUnit.SECONDS);
        if(!ended) process.destroyForcibly();
        String output=java.nio.file.Files.readString(log);
        if(output.length()>12000) output=output.substring(output.length()-12000);
        assertThat(ended).as(output).isTrue();
        assertThat(process.exitValue()).as(output).isZero();
        System.out.println(output);
    }


    @Test
    @org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable(named="RITMO_ANDROID_SERIAL",matches="emulator-[0-9]+")
    void androidRuntimePreservesExceptionsAndAccountIsolationThroughNativeAdapters() throws Exception {
        var log=java.nio.file.Path.of("build/android-exceptions-integration.log");
        var builder=new ProcessBuilder("node","--import","tsx","--test","test/integration/android-exceptions.test.ts")
            .directory(java.nio.file.Path.of("../app").toFile()).redirectErrorStream(true).redirectOutput(log.toFile());
        builder.environment().put("RITMO_TEST_API","http://127.0.0.1:"+port);
        var process=builder.start();
        boolean ended=process.waitFor(420,java.util.concurrent.TimeUnit.SECONDS);
        if(!ended) process.destroyForcibly();
        String output=java.nio.file.Files.readString(log);
        if(output.length()>16000) output=output.substring(output.length()-16000);
        assertThat(ended).as(output).isTrue();
        assertThat(process.exitValue()).as(output).isZero();
        System.out.println(output);
    }
    @Test
    @org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable(named="RITMO_ANDROID_JOURNEY_SERIAL",matches="emulator-[0-9]+")
    void androidProductJourneyWorksOfflineAndSynchronizesAfterRestart() throws Exception {
        var log=java.nio.file.Path.of("build/android-journey-integration.log");
        var builder=new ProcessBuilder("node","--import","tsx","--test","test/integration/android-journey.test.ts")
            .directory(java.nio.file.Path.of("../app").toFile()).redirectErrorStream(true).redirectOutput(log.toFile());
        builder.environment().put("RITMO_TEST_API","http://127.0.0.1:"+port);
        var process=builder.start();
        boolean ended=process.waitFor(930,java.util.concurrent.TimeUnit.SECONDS);
        if(!ended) process.destroyForcibly();
        String output=java.nio.file.Files.readString(log);
        if(output.length()>16000) output=output.substring(output.length()-16000);
        assertThat(ended).as(output).isTrue();
        assertThat(process.exitValue()).as(output).isZero();
        System.out.println(output);
    }

    @Test
    @org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable(named="RITMO_ANDROID_JOURNEY_SERIAL",matches="emulator-[0-9]+")
    void androidProductSessionRecoveryPreservesAccountIsolation() throws Exception {
        var log=java.nio.file.Path.of("build/android-journey-integration.log");
        var builder=new ProcessBuilder("node","--import","tsx","--test","test/integration/android-session.test.ts")
            .directory(java.nio.file.Path.of("../app").toFile()).redirectErrorStream(true).redirectOutput(log.toFile());
        builder.environment().put("RITMO_TEST_API","http://127.0.0.1:"+port);
        var process=builder.start();
        boolean ended=process.waitFor(930,java.util.concurrent.TimeUnit.SECONDS);
        if(!ended) process.destroyForcibly();
        String output=java.nio.file.Files.readString(log);
        if(output.length()>16000) output=output.substring(output.length()-16000);
        assertThat(ended).as(output).isTrue();
        assertThat(process.exitValue()).as(output).isZero();
        System.out.println(output);
    }

    @Test
    @org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable(named="RITMO_ANDROID_JOURNEY_SERIAL",matches="emulator-[0-9]+")
    void androidProductSynchronizationShowsRecoverableAndUncertainIntent() throws Exception {
        var log=java.nio.file.Path.of("build/android-journey-integration.log");
        var builder=new ProcessBuilder("node","--import","tsx","--test","test/integration/android-sync.test.ts")
            .directory(java.nio.file.Path.of("../app").toFile()).redirectErrorStream(true).redirectOutput(log.toFile());
        builder.environment().put("RITMO_TEST_API","http://127.0.0.1:"+port);
        var process=builder.start();
        boolean ended=process.waitFor(930,java.util.concurrent.TimeUnit.SECONDS);
        if(!ended) process.destroyForcibly();
        String output=java.nio.file.Files.readString(log);
        if(output.length()>16000) output=output.substring(output.length()-16000);
        assertThat(ended).as(output).isTrue();
        assertThat(process.exitValue()).as(output).isZero();
        System.out.println(output);
    }

}
