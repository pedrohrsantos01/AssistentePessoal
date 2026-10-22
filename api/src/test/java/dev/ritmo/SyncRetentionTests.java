package dev.ritmo;

import dev.ritmo.shared.Json;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.DriverManager;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SyncRetentionTests {
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres@sha256:5a5a84b19854a9ffaa54082c166ff4ec27473a361e496e5ea167f298f2da9722");
    static final MutableClock TIME = new MutableClock();
    static {
        POSTGRES.start();
        try (var connection=DriverManager.getConnection(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword());
             var statement=connection.createStatement()) {
            statement.execute("CREATE ROLE ritmo_domain LOGIN PASSWORD 'test-domain'; CREATE ROLE ritmo_identity LOGIN PASSWORD 'test-identity';");
        } catch (java.sql.SQLException error) { throw new ExceptionInInitializerError(error); }
    }
    @DynamicPropertySource static void database(DynamicPropertyRegistry properties) {
        properties.add("server.address",()->"127.0.0.1");
        properties.add("spring.datasource.url",POSTGRES::getJdbcUrl);
        properties.add("spring.datasource.username",()->"ritmo_domain");
        properties.add("spring.datasource.password",()->"test-domain");
        properties.add("spring.flyway.url",POSTGRES::getJdbcUrl);
        properties.add("spring.flyway.user",POSTGRES::getUsername);
        properties.add("spring.flyway.password",POSTGRES::getPassword);
        properties.add("ritmo.identity.url",POSTGRES::getJdbcUrl);
        properties.add("ritmo.identity.username",()->"ritmo_identity");
        properties.add("ritmo.identity.password",()->"test-identity");
        properties.add("ritmo.signing-key",()->java.util.Base64.getEncoder().encodeToString(new byte[32]));
        for (String scope:java.util.List.of("api-ip","account","login","register","reset-request","reset-confirm","refresh","revoke"))
            properties.add("ritmo.rate-limits."+scope+".capacity",()->1000000);
        properties.add("ritmo.sync-retention.enabled",()->true);
        properties.add("ritmo.sync-retention.poll-ms",()->100);
    }
    static final class MutableClock extends Clock {
        volatile Instant now=Instant.parse("2026-10-04T12:00:00Z");
        @Override public Instant instant() { return now; }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return Clock.fixed(now,zone); }
    }
    @org.springframework.boot.test.context.TestConfiguration(proxyBeanMethods=false)
    static class TestTime {
        @org.springframework.context.annotation.Bean @org.springframework.context.annotation.Primary
        Clock retentionClock() { return TIME; }
    }
    @LocalServerPort int port;
    final HttpClient http=HttpClient.newHttpClient();

    JsonNode request(String method,String path,String token,JsonNode body,int status) throws Exception {
        var builder=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/v1/"+path))
            .timeout(java.time.Duration.ofSeconds(15)).header("X-Ritmo-Protocol","m1.1").header("X-App-Version","0.1.0");
        if(token!=null) builder.header("Authorization","Bearer "+token);
        if(body==null) builder.GET();
        else builder.header("Content-Type","application/json").header("Idempotency-Key",Json.id())
            .method(method,HttpRequest.BodyPublishers.ofString(body.toString()));
        var response=http.send(builder.build(),HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(response.body()).isEqualTo(status);
        return Json.read(response.body());
    }
    JsonNode account() throws Exception {
        return request("POST","auth/register",null,Json.object().put("email",Json.id()+"@example.test")
            .put("password","fixture-password").put("displayName","Pessoa").put("deviceId",Json.id()),201);
    }
    JsonNode operation(String device,int sequence,JsonNode command) {
        var result=Json.object().put("operationId",Json.id()).put("deviceId",device).put("clientSequence",sequence)
            .put("occurredAt",TIME.now.toString());
        result.set("dependsOn",Json.array());result.set("command",command);return result;
    }
    JsonNode creation(String habit) {
        return Json.read("""
            {"type":"habit.create","habitId":"%s","title":"Caminhar","habitType":"binary",
             "scheduleKind":"daily","startDayKey":"2026-10-04","timeContext":{"timezone":"UTC","dayStartHour":0},
             "iconKey":null,"colorToken":null,"sortOrder":0}
            """.formatted(habit));
    }
    JsonNode edit(String habit,String title) {
        var command=Json.object().put("type","habit.patchMetadata").put("habitId",habit);
        command.set("patch",Json.object().put("title",title));return command;
    }
    JsonNode push(String token,JsonNode... operations) throws Exception {
        var body=Json.object();var values=Json.array();for(var operation:operations) values.add(operation);
        body.set("operations",values);var response=request("POST","sync/push",token,body,200);
        for(var result:response.path("results")) assertThat(result.at("/receipt/status").asString()).isEqualTo("accepted");
        return response;
    }
    String initialCursor(String token) throws Exception {
        var manifest=request("POST","sync/snapshots",token,Json.object(),201);
        return page(token,manifest,manifest.path("firstPageCursor").asString(),200).path("pullCursor").asString();
    }
    JsonNode page(String token,JsonNode manifest,String cursor,int status) throws Exception {
        return request("GET","sync/snapshots/"+manifest.path("snapshotId").asString()+"?cursor="+encode(cursor),token,null,status);
    }
    JsonNode pull(String token,String cursor,int status) throws Exception {
        return request("GET","sync/pull?cursor="+encode(cursor),token,null,status);
    }
    String encode(String value) { return java.net.URLEncoder.encode(value,java.nio.charset.StandardCharsets.UTF_8); }

    long retainedEnvelopes(String user,long through) throws Exception {
        // Operational metadata: physical retention is verified separately from domain assertions over HTTP.
        try(var connection=DriverManager.getConnection(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword());
            var statement=connection.prepareStatement("select count(*) from sync_changes where user_id=?::uuid and revision<=?")) {
            statement.setString(1,user);statement.setLong(2,through);
            try(var rows=statement.executeQuery()) { rows.next();return rows.getLong(1); }
        }
    }
    void awaitRemoved(String user,long through) throws Exception {
        long deadline=System.nanoTime()+java.time.Duration.ofSeconds(8).toNanos();
        while(retainedEnvelopes(user,through)!=0 && System.nanoTime()<deadline) Thread.sleep(50);
        assertThat(retainedEnvelopes(user,through)).as("the production daily executor removes expired envelopes").isZero();
    }

    @Test void dailyExpurgoRequiresResyncForARenewedCursorButRetainsTheCurrentSuffix() throws Exception {
        TIME.now=Instant.parse("2026-10-04T12:00:00Z");
        var session=account();String token=session.path("accessToken").asString(),user=session.path("accountId").asString();
        String cursor=initialCursor(token),device=Json.id(),habit=Json.id();
        push(token,operation(device,1,creation(habit)));
        for(int sequence=2;sequence<=501;sequence+=50) {
            var batch=new java.util.ArrayList<JsonNode>();
            for(int next=sequence;next<sequence+50 && next<=501;next++) batch.add(operation(device,next,edit(habit,"Caminhar "+next)));
            push(token,batch.toArray(JsonNode[]::new));
        }
        TIME.now=TIME.now.plusSeconds(89L*86400);
        var first=pull(token,cursor,200);
        assertThat(first.path("changes").size()).isEqualTo(500);
        assertThat(first.path("hasMore").asBoolean()).isTrue();
        String renewed=first.path("nextCursor").asString();
        String current=pull(token,renewed,200).path("nextCursor").asString();

        TIME.now=TIME.now.plusSeconds(2L*86400);
        push(token,operation(device,502,edit(habit,"Hoje")));
        awaitRemoved(user,501);
        assertThat(pull(token,renewed,409).at("/error/code").asString()).isEqualTo("resync_required");
        var suffix=pull(token,current,200);
        assertThat(suffix.path("changes").size()).isEqualTo(1);
        assertThat(suffix.at("/changes/0/revision").asString()).isEqualTo("502");
        assertThat(suffix.at("/changes/0/entities/0/value/title").asString()).isEqualTo("Hoje");
    }

    long snapshotRecords(String user) throws Exception {
        try(var connection=DriverManager.getConnection(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword());
            var statement=connection.prepareStatement("select count(*) from sync_snapshots where user_id=?::uuid")) {
            statement.setString(1,user);try(var rows=statement.executeQuery()) {rows.next();return rows.getLong(1);}
        }
    }
    @Test void dailyExpurgoRemovesExpiredCopiesAndAllowsANewSnapshot() throws Exception {
        TIME.now=Instant.parse("2026-10-04T12:00:00Z");
        var session=account();String token=session.path("accessToken").asString(),user=session.path("accountId").asString();
        String device=Json.id(),habit=Json.id();push(token,operation(device,1,creation(habit)));
        var expired=request("POST","sync/snapshots",token,Json.object(),201);
        TIME.now=TIME.now.plusSeconds(86400);
        long deadline=System.nanoTime()+java.time.Duration.ofSeconds(8).toNanos();
        while(snapshotRecords(user)!=0&&System.nanoTime()<deadline) Thread.sleep(50);
        assertThat(snapshotRecords(user)).as("production maintenance removes expired manifests and items").isZero();
        page(token,expired,expired.path("firstPageCursor").asString(),404);
        var replacement=request("POST","sync/snapshots",token,Json.object(),201);
        var copy=page(token,replacement,replacement.path("firstPageCursor").asString(),200);
        assertThat(copy.path("complete").asBoolean()).isTrue();
        assertThat(copy.path("entities").size()).isEqualTo(2);
        assertThat(retainedEnvelopes(user,1)).isEqualTo(1);
    }

    @Test void aPageAndReceiptsRevalidateExpiryAfterWaitingForTheAccountLock() throws Exception {
        TIME.now=Instant.parse("2026-10-04T12:00:00Z");
        var session=account();String token=session.path("accessToken").asString(),user=session.path("accountId").asString();
        var manifest=request("POST","sync/snapshots",token,Json.object(),201);
        try(var owner=DriverManager.getConnection(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword());
            var workers=java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
            owner.setAutoCommit(false);
            // Hold the same account-first boundary as native and web commands;
            // keep sync state locked too so maintenance cannot delete the fixture.
            try(var statement=owner.prepareStatement("select id from users where id=?::uuid for update")) {
                statement.setString(1,user);statement.executeQuery().close();
            }
            try(var statement=owner.prepareStatement("select last_revision from sync_account_state where user_id=?::uuid for update")) {
                statement.setString(1,user);statement.executeQuery().close();
            }
            var page=workers.submit(()->page(token,manifest,manifest.path("firstPageCursor").asString(),410));
            var receipts=workers.submit(()->request("POST","sync/receipts",token,Json.read(
                "{\"snapshotId\":\""+manifest.path("snapshotId").asString()+"\",\"operationIds\":[\""+Json.id()+"\"]}"),410));
            try {
                boolean waiting=false;long deadline=System.nanoTime()+java.time.Duration.ofSeconds(3).toNanos();
                while(!waiting&&!page.isDone()&&!receipts.isDone()&&System.nanoTime()<deadline) {
                    try(var probe=DriverManager.getConnection(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword());
                        var statement=probe.createStatement();
                        var rows=statement.executeQuery("select count(*) from pg_stat_activity where usename='ritmo_domain' and wait_event_type='Lock' and query like '%from users%'")) {
                        rows.next();waiting=rows.getInt(1)>=2;
                    }
                    if(!waiting) Thread.sleep(20);
                }
                assertThat(waiting).as("both public reads wait on the same account boundary").isTrue();
                TIME.now=TIME.now.plusSeconds(900);
                // Keep the daily executor from removing this fixture before its waiting HTTP reads resume.
                try(var statement=owner.prepareStatement("update sync_account_state set retention_next_at=?::timestamptz where user_id=?::uuid")) {
                    statement.setString(1,TIME.now.plusSeconds(86400).toString());statement.setString(2,user);statement.executeUpdate();
                }
            } finally {owner.commit();}
            assertThat(page.get(10,java.util.concurrent.TimeUnit.SECONDS).at("/error/code").asString()).isEqualTo("snapshot_expired");
            assertThat(receipts.get(10,java.util.concurrent.TimeUnit.SECONDS).at("/error/code").asString()).isEqualTo("snapshot_expired");
        }
    }

    @Test void reopenedSqliteRecoversAcrossTheRealDailyCleanerAndAnExpiredCopy() throws Exception {
        TIME.now=Instant.parse("2026-10-04T12:00:00Z");
        var control=java.nio.file.Files.createTempDirectory(java.nio.file.Path.of("build"),"retention-clock-");
        var log=java.nio.file.Path.of("build/retention-mobile-integration.log");
        var builder=new ProcessBuilder("node","--import","tsx","--test","test/integration/retention.test.ts")
            .directory(java.nio.file.Path.of("../app").toFile()).redirectErrorStream(true).redirectOutput(log.toFile());
        builder.environment().put("RITMO_TEST_API","http://127.0.0.1:"+port);
        builder.environment().put("RITMO_RETENTION_CONTROL",control.toAbsolutePath().toString());
        var process=builder.start();
        try {
            String user=awaitClockBoundary(control,"feed",process,log);
            TIME.now=TIME.now.plusSeconds(91L*86400);awaitRemoved(user,5);
            awaitNoCopies(user);java.nio.file.Files.writeString(control.resolve("feed.go"),"ready");
            assertThat(awaitClockBoundary(control,"copy",process,log)).isEqualTo(user);
            TIME.now=TIME.now.plusSeconds(86400);awaitNoCopies(user);
            java.nio.file.Files.writeString(control.resolve("copy.go"),"ready");
            assertThat(process.waitFor(60,java.util.concurrent.TimeUnit.SECONDS)).as(java.nio.file.Files.readString(log)).isTrue();
            assertThat(process.exitValue()).as(java.nio.file.Files.readString(log)).isZero();
            System.out.println(java.nio.file.Files.readString(log));
        } finally {
            if(process.isAlive()) process.destroyForcibly();
            for(String file:java.util.List.of("feed.ready","feed.ready.tmp","feed.go","copy.ready","copy.ready.tmp","copy.go"))
                java.nio.file.Files.deleteIfExists(control.resolve(file));
            java.nio.file.Files.deleteIfExists(control);
        }
    }
    String awaitClockBoundary(java.nio.file.Path directory,String stage,Process process,java.nio.file.Path log) throws Exception {
        long deadline=System.nanoTime()+java.time.Duration.ofSeconds(30).toNanos();
        var path=directory.resolve(stage+".ready");
        while(!java.nio.file.Files.exists(path)&&process.isAlive()&&System.nanoTime()<deadline) Thread.sleep(25);
        assertThat(java.nio.file.Files.exists(path)).as(java.nio.file.Files.readString(log)).isTrue();
        return Json.read(java.nio.file.Files.readString(path)).path("user").asString();
    }
    void awaitNoCopies(String user) throws Exception {
        long deadline=System.nanoTime()+java.time.Duration.ofSeconds(8).toNanos();
        while(snapshotRecords(user)!=0&&System.nanoTime()<deadline) Thread.sleep(50);
        assertThat(snapshotRecords(user)).as("real expired-copy cleanup").isZero();
    }

    java.sql.Connection maintenanceConnection(String user) throws Exception {
        var connection=DriverManager.getConnection(POSTGRES.getJdbcUrl(),"ritmo_domain","test-domain");
        connection.setAutoCommit(false);
        try(var statement=connection.prepareStatement("select set_config('app.user_id',?,true),set_config('statement_timeout','2000',true),set_config('lock_timeout','500',true)")) {
            statement.setString(1,user);statement.executeQuery().close();
        }
        return connection;
    }
    void due(java.sql.Connection connection,String user) throws Exception {
        // Scoped operational fixture: make this account due without running an imaginary cleaner.
        try(var statement=connection.prepareStatement("update sync_account_state set retention_next_at='-infinity' where user_id=?::uuid")) {
            statement.setString(1,user);statement.executeUpdate();
        }
    }
    JsonNode expire(java.sql.Connection connection,String user,Instant now,int limit) throws Exception {
        try(var statement=connection.prepareStatement("select public.ritmo_expire_sync(?::uuid,?::timestamptz,?::timestamptz,?)")) {
            statement.setString(1,user);statement.setString(2,now.toString());statement.setString(3,now.plusSeconds(86400).toString());statement.setInt(4,limit);
            try(var rows=statement.executeQuery()) {rows.next();return Json.read(rows.getString(1));}
        }
    }
    @Test void theNinetyDayBoundaryUsesElapsedTimeEvenAcrossDatabaseDaylightSaving() throws Exception {
        TIME.now=Instant.parse("2026-10-04T12:00:00Z");
        var session=account();String token=session.path("accessToken").asString(),user=session.path("accountId").asString();
        push(token,operation(Json.id(),1,creation(Json.id())));
        Instant now=Instant.parse("2026-06-01T12:00:00Z");
        try(var connection=maintenanceConnection(user)) {
            due(connection,user);
            try(var statement=connection.createStatement()) {statement.execute("set local time zone 'America/New_York'");}
            try(var statement=connection.prepareStatement("update sync_changes set committed_at=?::timestamptz where user_id=?::uuid")) {
                statement.setString(1,now.minusSeconds(90L*86400).toString());statement.setString(2,user);statement.executeUpdate();
            }
            assertThat(expire(connection,user,now,500).path("removedEnvelopes").asInt())
                .as("exactly ninety elapsed days remains retained in every connection timezone").isZero();
            due(connection,user);
            assertThat(expire(connection,user,now.plusSeconds(1),500).path("removedEnvelopes").asInt()).isEqualTo(1);
            connection.commit();
        }
    }

    void freeze(String user) throws Exception {
        try(var owner=DriverManager.getConnection(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword());
            var statement=owner.prepareStatement("update sync_account_state set retention_next_at='infinity' where user_id=?::uuid")) {
            statement.setString(1,user);statement.executeUpdate();
        }
    }
    void age(java.sql.Connection connection,String user,long first,long last,Instant at) throws Exception {
        try(var statement=connection.prepareStatement("update sync_changes set committed_at=?::timestamptz where user_id=?::uuid and revision between ? and ?")) {
            statement.setString(1,at.toString());statement.setString(2,user);statement.setLong(3,first);statement.setLong(4,last);statement.executeUpdate();
        }
    }
    JsonNode physicalState(java.sql.Connection connection,String user) throws Exception {
        try(var statement=connection.prepareStatement("""
            select jsonb_build_object('floor',s.feed_compacted_through::text,
              'envelopes',(select count(*) from sync_changes c where c.user_id=s.user_id),
              'items',(select count(*) from sync_snapshot_items i where i.user_id=s.user_id),
              'copies',(select count(*) from sync_snapshots n where n.user_id=s.user_id))
            from sync_account_state s where s.user_id=?::uuid
            """)) {
            statement.setString(1,user);try(var rows=statement.executeQuery()) {return rows.next()?Json.read(rows.getString(1)):null;}
        }
    }
    @Test void anUnexpiredRevisionStopsThePrefixEvenIfLaterTimestampsAreOlder() throws Exception {
        TIME.now=Instant.parse("2026-10-04T12:00:00Z");
        var session=account();String token=session.path("accessToken").asString(),user=session.path("accountId").asString();
        String habit=Json.id(),device=Json.id();push(token,operation(device,1,creation(habit)),
            operation(device,2,edit(habit,"Segundo")),operation(device,3,edit(habit,"Terceiro")));
        freeze(user);
        try(var connection=maintenanceConnection(user)) {
            due(connection,user);age(connection,user,1,3,TIME.now.minusSeconds(91L*86400));
            age(connection,user,2,2,TIME.now.minusSeconds(90L*86400));
            var result=expire(connection,user,TIME.now,500);
            assertThat(result.path("removedEnvelopes").asInt()).isEqualTo(1);
            assertThat(result.path("status").asString()).isEqualTo("complete");
            assertThat(result.path("floor").asString()).isEqualTo("1");
            assertThat(physicalState(connection,user).path("envelopes").asInt()).isEqualTo(2);
            due(connection,user);
            assertThat(expire(connection,user,TIME.now.plusSeconds(1),500).path("removedEnvelopes").asInt()).isEqualTo(2);
            connection.commit();
        }
        var manifest=request("POST","sync/snapshots",token,Json.object(),201);
        assertThat(page(token,manifest,manifest.path("firstPageCursor").asString(),200).path("entities").toString()).contains("Terceiro");
    }
    @Test void aValidPagedSnapshotReservesItsSuffixWhileThePrefixIsRemovedInLimitedBatches() throws Exception {
        TIME.now=Instant.parse("2026-10-04T12:00:00Z");
        var session=account();String token=session.path("accessToken").asString(),user=session.path("accountId").asString();
        String device=Json.id();var creations=new java.util.ArrayList<JsonNode>();String firstHabit=null;
        for(int sequence=1;sequence<=501;sequence++) {
            String habit=Json.id();if(sequence==1) firstHabit=habit;
            var command=(tools.jackson.databind.node.ObjectNode)creation(habit);command.put("title","Rotina "+sequence);
            creations.add(operation(device,sequence,command));
        }
        for(int offset=0;offset<creations.size();offset+=50)
            push(token,creations.subList(offset,Math.min(offset+50,creations.size())).toArray(JsonNode[]::new));
        freeze(user);
        var cut=request("POST","sync/snapshots",token,Json.object(),201);
        var first=page(token,cut,cut.path("firstPageCursor").asString(),200);
        assertThat(first.path("entities").size()).isEqualTo(500);assertThat(first.path("complete").asBoolean()).isFalse();
        var newer=operation(device,502,edit(firstHabit,"Depois de H"));push(token,newer);
        try(var connection=maintenanceConnection(user)) {
            due(connection,user);age(connection,user,1,502,TIME.now.minusSeconds(91L*86400));
            var one=expire(connection,user,TIME.now,500);
            assertThat(one.path("removedEnvelopes").asInt()).isEqualTo(500);assertThat(one.path("status").asString()).isEqualTo("pending");
            var two=expire(connection,user,TIME.now,500);
            assertThat(two.path("removedEnvelopes").asInt()).isEqualTo(1);assertThat(two.path("floor").asString()).isEqualTo("501");
            due(connection,user);var pinned=expire(connection,user,TIME.now,500);
            assertThat(pinned.path("removedEnvelopes").asInt()).isZero();
            assertThat(physicalState(connection,user).path("items").asInt()).isEqualTo(502);
            connection.commit();
        }
        push(token,operation(device,503,edit(firstHabit,"Escrita concorrente")));
        var second=page(token,cut,first.path("nextPageCursor").asString(),200);
        assertThat(second.path("entities").size()).isEqualTo(2);assertThat(second.path("highWaterRevision").asString()).isEqualTo("501");
        var copy=Json.array();first.path("entities").forEach(copy::add);second.path("entities").forEach(copy::add);
        JsonNode preserved=null;
        for(var entity:copy) if(entity.path("kind").asString().equals("habit")&&entity.at("/value/habitId").asString().equals(firstHabit)) preserved=entity;
        assertThat(preserved).isNotNull();assertThat(preserved.at("/value/title").asString()).isEqualTo("Rotina 1");
        assertThat(copy.toString()).doesNotContain("Depois de H").doesNotContain("Escrita concorrente");
        var classified=request("POST","sync/receipts",token,Json.read("{\"snapshotId\":\""+cut.path("snapshotId").asString()
            +"\",\"operationIds\":[\""+creations.getFirst().path("operationId").asString()+"\",\""+newer.path("operationId").asString()+"\"]}"),200);
        assertThat(classified.at("/results/0/acceptedRevision").asString()).isEqualTo("1");
        assertThat(classified.at("/results/1/status").asString()).isEqualTo("notProcessedAtH");
        var suffix=pull(token,second.path("pullCursor").asString(),200);
        assertThat(suffix.path("changes").size()).isEqualTo(2);
        assertThat(suffix.at("/changes/0/revision").asString()).isEqualTo("502");
        assertThat(suffix.at("/changes/1/revision").asString()).isEqualTo("503");
        TIME.now=TIME.now.plusSeconds(900);
        try(var connection=maintenanceConnection(user)) {
            due(connection,user);var limited=expire(connection,user,TIME.now,3);
            assertThat(limited.path("removedItems").asInt()).isEqualTo(3);
            assertThat(limited.path("removedSnapshots").asInt()).isZero();
            assertThat(physicalState(connection,user).path("items").asInt()).isEqualTo(499);
            assertThat(physicalState(connection,user).path("copies").asInt()).isEqualTo(1);
            try(var statement=connection.prepareStatement("update sync_account_state set retention_next_at='infinity' where user_id=?::uuid")) {statement.setString(1,user);statement.executeUpdate();}
            connection.commit();
        }
        page(token,cut,cut.path("firstPageCursor").asString(),410);
    }
    @Test void aDatabaseFailureRollsBackRemovalAndFloorAndTheNextAttemptCanFinish() throws Exception {
        TIME.now=Instant.parse("2026-10-04T12:00:00Z");
        var session=account();String token=session.path("accessToken").asString(),user=session.path("accountId").asString();
        String cursor=initialCursor(token),device=Json.id(),habit=Json.id();
        push(token,operation(device,1,creation(habit)),operation(device,2,edit(habit,"Segundo")),operation(device,3,edit(habit,"Terceiro")));
        freeze(user);TIME.now=TIME.now.plusSeconds(3600);
        try(var connection=maintenanceConnection(user)) {age(connection,user,1,3,TIME.now.minusSeconds(91L*86400));connection.commit();}
        try(var owner=DriverManager.getConnection(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword());
            var statement=owner.createStatement()) {
            statement.execute("""
                create function public.test_retention_failure() returns trigger language plpgsql as $test$
                begin if old.user_id='%s'::uuid then raise exception 'Injected deletion failure'; end if;return old;end $test$;
                create trigger test_retention_failure before delete on sync_changes for each row execute function public.test_retention_failure();
                """.formatted(user));
            try {
                try(var connection=maintenanceConnection(user)) {
                    due(connection,user);
                    org.assertj.core.api.Assertions.assertThatThrownBy(()->expire(connection,user,TIME.now,500))
                        .isInstanceOf(java.sql.SQLException.class);connection.rollback();restoreContext(connection,user);
                    assertThat(physicalState(connection,user).path("floor").asString()).isEqualTo("0");
                    assertThat(physicalState(connection,user).path("envelopes").asInt()).isEqualTo(3);
                }
                assertThat(pull(token,cursor,200).path("changes").size()).isEqualTo(3);
            } finally {statement.execute("drop trigger test_retention_failure on sync_changes;drop function public.test_retention_failure();");}
        }
        try(var connection=maintenanceConnection(user)) {
            due(connection,user);assertThat(expire(connection,user,TIME.now,500).path("removedEnvelopes").asInt()).isEqualTo(3);connection.commit();
        }
        assertThat(pull(token,cursor,409).at("/error/code").asString()).isEqualTo("resync_required");
    }
    @Test void maintenanceCannotCrossAccountsAndDoesNotGrantIdentityOrPublicAnInvokerPrivilege() throws Exception {
        TIME.now=Instant.parse("2026-10-04T12:00:00Z");
        var a=account();var b=account();String userA=a.path("accountId").asString(),userB=b.path("accountId").asString();
        String tokenB=b.path("accessToken").asString();push(tokenB,operation(Json.id(),1,creation(Json.id())));
        var cut=request("POST","sync/snapshots",tokenB,Json.object(),201);freeze(userB);
        try(var connection=maintenanceConnection(userA)) {
            assertThat(physicalState(connection,userB)).isNull();
            org.assertj.core.api.Assertions.assertThatThrownBy(()->expire(connection,userB,TIME.now,1))
                .isInstanceOfSatisfying(java.sql.SQLException.class,failure->assertThat(failure.getSQLState()).isEqualTo("42501"));
            connection.rollback();
        }
        try(var identity=DriverManager.getConnection(POSTGRES.getJdbcUrl(),"ritmo_identity","test-identity")) {
            org.assertj.core.api.Assertions.assertThatThrownBy(()->expire(identity,userB,TIME.now,1))
                .isInstanceOfSatisfying(java.sql.SQLException.class,failure->assertThat(failure.getSQLState()).isEqualTo("42501"));
        }
        page(a.path("accessToken").asString(),cut,cut.path("firstPageCursor").asString(),404);
        assertThat(page(tokenB,cut,cut.path("firstPageCursor").asString(),200).path("entities").size()).isEqualTo(2);
        assertThat(retainedEnvelopes(userB,1)).isEqualTo(1);
        try(var owner=DriverManager.getConnection(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword());
            var statement=owner.createStatement();var rows=statement.executeQuery("""
                select bool_and(not rolbypassrls and not rolsuper),
                  has_function_privilege('ritmo_identity','ritmo_expire_sync(uuid,timestamptz,timestamptz,integer)','execute'),
                  (select prosecdef from pg_proc where oid='ritmo_expire_sync(uuid,timestamptz,timestamptz,integer)'::regprocedure),
                  (select count(*) from pg_proc p,aclexplode(p.proacl) a
                   where p.oid='ritmo_expire_sync(uuid,timestamptz,timestamptz,integer)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE')
                from pg_roles where rolname in ('ritmo_domain','ritmo_identity')
                """)) {
            rows.next();assertThat(rows.getBoolean(1)).isTrue();assertThat(rows.getBoolean(2)).isFalse();
            assertThat(rows.getBoolean(3)).isFalse();assertThat(rows.getInt(4)).isZero();
        }
    }
    @Test void invalidBatchLimitsFailBeforeChangingRetentionState() throws Exception {
        TIME.now=Instant.parse("2026-10-04T12:00:00Z");
        var session=account();String user=session.path("accountId").asString();
        push(session.path("accessToken").asString(),operation(Json.id(),1,creation(Json.id())));
        for(int limit:new int[]{0,5001}) try(var connection=maintenanceConnection(user)) {
            due(connection,user);
            org.assertj.core.api.Assertions.assertThatThrownBy(()->expire(connection,user,TIME.now,limit))
                .isInstanceOfSatisfying(java.sql.SQLException.class,failure->assertThat(failure.getSQLState()).isEqualTo("22023"));
            connection.rollback();restoreContext(connection,user);assertThat(physicalState(connection,user).path("floor").asString()).isEqualTo("0");
        }
    }
    void restoreContext(java.sql.Connection connection,String user) throws Exception {
        try(var statement=connection.prepareStatement("select set_config('app.user_id',?,true)")) {
            statement.setString(1,user);statement.executeQuery().close();
        }
    }

    @Test void failureInOneAccountLeavesItDueAndTheDailyExecutorStillCleansAnotherAccount() throws Exception {
        TIME.now=Instant.parse("2026-10-04T12:00:00Z");
        var a=account();var b=account();String userA=a.path("accountId").asString(),userB=b.path("accountId").asString();
        for(var session:java.util.List.of(a,b)) {
            push(session.path("accessToken").asString(),operation(Json.id(),1,creation(Json.id())));
            freeze(session.path("accountId").asString());
        }
        try(var owner=DriverManager.getConnection(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword());
            var statement=owner.createStatement()) {
            statement.execute("""
                create function public.test_retention_account_failure() returns trigger language plpgsql as $test$
                begin if old.user_id='%s'::uuid then raise exception 'Injected account failure'; end if;return old;end $test$;
                create trigger test_retention_account_failure before delete on sync_changes for each row execute function public.test_retention_account_failure();
                """.formatted(userA));
            try {
                owner.setAutoCommit(false);
                for(String user:java.util.List.of(userA,userB)) {
                    age(owner,user,1,1,TIME.now.minusSeconds(91L*86400));due(owner,user);
                }
                owner.commit();awaitRemoved(userB,1);
                assertThat(retainedEnvelopes(userA,1)).isEqualTo(1);
                try(var connection=maintenanceConnection(userA)) {
                    assertThat(physicalState(connection,userA).path("floor").asString()).isEqualTo("0");
                }
            } finally {
                owner.rollback();owner.setAutoCommit(true);
                statement.execute("drop trigger test_retention_account_failure on sync_changes;drop function public.test_retention_account_failure();");
            }
        }
        awaitRemoved(userA,1);
    }
}
