package dev.ritmo;

import java.nio.file.*;
import java.net.URI;
import java.net.http.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.MountableFile;
import dev.ritmo.shared.Json;
import tools.jackson.databind.JsonNode;
import static org.assertj.core.api.Assertions.assertThat;

class RestoreTests {
    private static final String IMAGE="postgres@sha256:5a5a84b19854a9ffaa54082c166ff4ec27473a361e496e5ea167f298f2da9722";
    private final HttpClient http=HttpClient.newHttpClient();
    private record Api(ConfigurableApplicationContext context,String origin) implements AutoCloseable {
        @Override public void close() {context.close();}
    }
    private Api startApi(PostgreSQLContainer db) {return startApi(db,Map.of());}
    private Api startApi(PostgreSQLContainer db,Map<String,String> overrides) {
        var settings=new LinkedHashMap<String,String>();
        settings.put("server.port","0");settings.put("server.address","127.0.0.1");settings.put("logging.level.root","ERROR");
        settings.put("spring.datasource.url",db.getJdbcUrl());settings.put("spring.datasource.username","app_domain");settings.put("spring.datasource.password","fixture-domain");
        settings.put("spring.flyway.url",db.getJdbcUrl());settings.put("spring.flyway.user",db.getUsername());settings.put("spring.flyway.password",db.getPassword());
        settings.put("ritmo.identity.url",db.getJdbcUrl());settings.put("ritmo.identity.username","app_identity");settings.put("ritmo.identity.password","fixture-identity");
        settings.put("ritmo.signing-key",Base64.getEncoder().encodeToString(new byte[32]));settings.put("spring.mail.host","127.0.0.1");
        settings.putAll(overrides);
        var args=settings.entrySet().stream().map(e->"--"+e.getKey()+"="+e.getValue()).toArray(String[]::new);
        var context=new SpringApplicationBuilder(RitmoApplication.class).run(args);
        int port=context.getEnvironment().getRequiredProperty("local.server.port",Integer.class);
        return new Api(context,"http://127.0.0.1:"+port);
    }
    private org.testcontainers.containers.Container.ExecResult command(PostgreSQLContainer db,String... args) throws Exception {
        var all=new ArrayList<String>(List.of("env","PGHOST=127.0.0.1","PGDATABASE="+db.getDatabaseName(),"PGUSER="+db.getUsername(),"PGPASSWORD="+db.getPassword()));
        all.addAll(List.of(args));return db.execInContainer(all.toArray(String[]::new));
    }
    private void succeeds(PostgreSQLContainer db,String... args) throws Exception {
        var result=command(db,args);assertThat(result.getExitCode()).as(result.getStderr()).isZero();
    }
    private void refuses(PostgreSQLContainer db,String reason,String... args) throws Exception {
        var result=command(db,args);assertThat(result.getExitCode()).isNotZero();assertThat(result.getStderr()).contains(reason);
    }
    private void provision(PostgreSQLContainer db) throws Exception {
        db.copyFileToContainer(MountableFile.forHostPath("ops/bootstrap-roles.sql"),"/tmp/bootstrap-roles.sql");
        succeeds(db,"psql","--no-password","-v","ON_ERROR_STOP=1","-f","/tmp/bootstrap-roles.sql");
        succeeds(db,"psql","--no-password","-v","ON_ERROR_STOP=1","-c","""
            CREATE ROLE app_domain LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'fixture-domain';
            CREATE ROLE app_identity LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'fixture-identity';
            GRANT ritmo_domain TO app_domain; GRANT ritmo_identity TO app_identity;
            """);
    }
    private void scripts(PostgreSQLContainer db) {
        for(String script:List.of("backup.sh","restore.sh","prepare-recovery.sh","prepare-recovery.sql")) db.copyFileToContainer(MountableFile.forHostPath("ops/"+script),"/tmp/"+script);
    }
    private JsonNode post(Api api,String path,String token,JsonNode body,int expected) throws Exception {
        var request=HttpRequest.newBuilder(URI.create(api.origin()+"/api/v1/"+path))
            .header("Content-Type","application/json").header("X-Ritmo-Protocol","m1.1").header("X-App-Version","0.1.0").header("Idempotency-Key",Json.id());
        if(token!=null) request.header("Authorization","Bearer "+token);
        var response=http.send(request.POST(HttpRequest.BodyPublishers.ofString(body.toString())).build(),HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(expected);return response.body().isEmpty()?Json.object():Json.read(response.body());
    }
    private JsonNode registration(Api api,String email) throws Exception {
        return post(api,"auth/register",null,Json.object().put("email",email).put("password","fixture-password").put("displayName","Restore fixture").put("deviceId",Json.id()),201);
    }
    private JsonNode operation(int sequence,JsonNode command) {
        var operation=Json.object().put("operationId",Json.id()).put("deviceId","01996300-0000-7000-8000-000000000002")
            .put("clientSequence",sequence).put("occurredAt","2026-09-25T13:00:00Z");
        operation.set("dependsOn",Json.array());operation.set("command",command);return operation;
    }
    private JsonNode push(Api api,String token,JsonNode... operations) throws Exception {
        var body=Json.object();var list=Json.array();for(var operation:operations) list.add(operation);body.set("operations",list);return post(api,"sync/push",token,body,200);
    }
    private JsonNode create(String habit) {
        var command=Json.object().put("type","habit.create").put("habitId",habit).put("title","Restore habit").put("habitType","binary")
            .put("scheduleKind","daily").put("startDayKey","2026-09-25").put("sortOrder",0);
        command.set("timeContext",Json.object().put("timezone","UTC").put("dayStartHour",4));command.putNull("iconKey");command.putNull("colorToken");return command;
    }
    private JsonNode page(Api api,String token,JsonNode manifest,int expected) throws Exception {
        var uri=URI.create(api.origin()+"/api/v1/sync/snapshots/"+manifest.path("snapshotId").asString()+"?cursor="+manifest.path("firstPageCursor").asString());
        var request=HttpRequest.newBuilder(uri).header("Authorization","Bearer "+token).header("X-Ritmo-Protocol","m1.1").header("X-App-Version","0.1.0").GET().build();
        var response=http.send(request,HttpResponse.BodyHandlers.ofString());assertThat(response.statusCode()).isEqualTo(expected);return Json.read(response.body());
    }
    @Test @Timeout(120) void quarantinedApiNeverPublishesARecoveredSnapshot() throws Exception {
        try(var db=new PostgreSQLContainer(IMAGE).withUsername("recovery_owner")) {
            db.start();provision(db);JsonNode account,manifest;
            try(var api=startApi(db)) {
                account=registration(api,"quarantine@example.test");
                manifest=post(api,"sync/snapshots",account.path("accessToken").asString(),Json.object(),201);
            }
            try(var api=startApi(db,Map.of("ritmo.operations.quarantined","true"))) {
                var failure=post(api,"sync/snapshots",account.path("accessToken").asString(),Json.object(),503);
                assertThat(failure.at("/error/code").asString()).isEqualTo("temporarily_unavailable");
                for(String route:List.of("auth/register","auth/login","auth/password-reset/request","auth/password-reset/confirm","auth/refresh","auth/revoke","sync/receipts","sync/push"))
                    assertThat(post(api,route,"invalid-fixture-token",Json.object(),503).at("/error/code").asString()).isEqualTo("temporarily_unavailable");
                for(String route:List.of("sync/pull","%73ync/pull")) {
                    var request=HttpRequest.newBuilder(URI.create(api.origin()+"/api/v1/"+route)).GET().build();
                    assertThat(http.send(request,HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(503);
                }
                assertThat(page(api,account.path("accessToken").asString(),manifest,503).at("/error/code").asString()).isEqualTo("temporarily_unavailable");
                var malformed=HttpRequest.newBuilder(URI.create(api.origin()+"/api/v1/auth/login"))
                    .POST(HttpRequest.BodyPublishers.ofString("{")).build();
                assertThat(http.send(malformed,HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(503);
                db.stop();
                assertThat(post(api,"sync/snapshots",null,Json.object(),503).at("/error/code").asString()).isEqualTo("temporarily_unavailable");
            }
        }
    }
    @Test @Timeout(180) void recoveryPreparationRevokesAllFamiliesAndResetLinksWithoutChangingPasswords() throws Exception {
        var mail=new com.icegreen.greenmail.util.GreenMail(new com.icegreen.greenmail.util.ServerSetup(0,"127.0.0.1","smtp"));
        mail.start();
        try(var db=new PostgreSQLContainer(IMAGE).withUsername("recovery_owner")) {
            db.start();provision(db);JsonNode a,b,renewed;String reset;
            var smtp=Map.of("spring.mail.port",Integer.toString(mail.getSmtp().getPort()),
                "spring.mail.properties.mail.smtp.auth","false","spring.mail.properties.mail.smtp.starttls.required","false",
                "spring.mail.properties.mail.smtp.starttls.enable","false","ritmo.recovery.origin","https://api.example.test",
                "ritmo.recovery.from","no-reply@example.test");
            try(var api=startApi(db,smtp)) {
                a=registration(api,"recovery-a@example.test");b=registration(api,"recovery-b@example.test");
                post(api,"auth/password-reset/request",null,Json.object().put("email","recovery-a@example.test"),202);
                org.awaitility.Awaitility.await().atMost(java.time.Duration.ofSeconds(10)).until(()->mail.getReceivedMessages().length==1);
                try(var input=mail.getReceivedMessages()[0].getInputStream()) {
                    var match=java.util.regex.Pattern.compile("token=([A-Za-z0-9_-]{43})")
                        .matcher(new String(input.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8));
                    assertThat(match.find()).isTrue();reset=match.group(1);
                }
            }
            for(String script:List.of("prepare-recovery.sh","prepare-recovery.sql"))
                db.copyFileToContainer(MountableFile.forHostPath("ops/"+script),"/tmp/"+script);
            refuses(db,"recovery_requires_quarantine","sh","/tmp/prepare-recovery.sh");
            refuses(db,"recovery_requires_verified_restore","env","RITMO_RECOVERY_QUARANTINE=true","sh","/tmp/prepare-recovery.sh");
            refuses(db,"recovery_requires_migration_owner","env","PGUSER=app_identity","PGPASSWORD=fixture-identity",
                "RITMO_RECOVERY_QUARANTINE=true","RITMO_RECOVERY_VERIFIED=true","sh","/tmp/prepare-recovery.sh");
            // Fault in the final statement must roll back earlier revocations. Assert only via HTTP.
            succeeds(db,"psql","--no-password","-v","ON_ERROR_STOP=1","-c","ALTER TABLE identity_password_resets RENAME COLUMN used_at TO fixture_used_at");
            refuses(db,"used_at","env","RITMO_RECOVERY_QUARANTINE=true","RITMO_RECOVERY_VERIFIED=true","sh","/tmp/prepare-recovery.sh");
            succeeds(db,"psql","--no-password","-v","ON_ERROR_STOP=1","-c","ALTER TABLE identity_password_resets RENAME COLUMN fixture_used_at TO used_at");
            try(var api=startApi(db,smtp)) {
                renewed=post(api,"auth/refresh",null,Json.object().put("refreshToken",a.path("refreshToken").asString()),200);
            }
            succeeds(db,"psql","--no-password","-v","ON_ERROR_STOP=1","-c","""
                CREATE ROLE recovery_operator LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD 'fixture-operator';
                GRANT USAGE ON SCHEMA public TO recovery_operator;
                ALTER TABLE identity_sessions OWNER TO recovery_operator;
                ALTER TABLE identity_refresh_tokens OWNER TO recovery_operator;
                ALTER TABLE identity_password_resets OWNER TO recovery_operator;
                ALTER TABLE identity_web_contexts OWNER TO recovery_operator;
                """);
            for(int repeat=0;repeat<2;repeat++) succeeds(db,"env","PGUSER=recovery_operator","PGPASSWORD=fixture-operator",
                "RITMO_RECOVERY_QUARANTINE=true","RITMO_RECOVERY_VERIFIED=true","sh","/tmp/prepare-recovery.sh");
            var rotated=new LinkedHashMap<>(smtp);rotated.put("ritmo.signing-key",Base64.getEncoder().encodeToString("11111111111111111111111111111111".getBytes(java.nio.charset.StandardCharsets.US_ASCII)));
            try(var api=startApi(db,rotated)) {
                post(api,"sync/snapshots",a.path("accessToken").asString(),Json.object(),401);
                post(api,"auth/refresh",null,Json.object().put("refreshToken",renewed.path("refreshToken").asString()),401);
                post(api,"auth/refresh",null,Json.object().put("refreshToken",b.path("refreshToken").asString()),401);
                assertThat(post(api,"auth/password-reset/confirm",null,Json.object().put("resetToken",reset).put("newPassword","unwanted-password"),401)
                    .at("/error/code").asString()).isEqualTo("reset_invalid");
                var login=post(api,"auth/login",null,Json.object().put("email","recovery-a@example.test").put("password","fixture-password").put("deviceId",Json.id()),200);
                assertThat(login.path("accountId")).isEqualTo(a.path("accountId"));
                post(api,"sync/snapshots",login.path("accessToken").asString(),Json.object(),201);
                post(api,"auth/refresh",null,Json.object().put("refreshToken",login.path("refreshToken").asString()),200);
                post(api,"auth/login",null,Json.object().put("email","recovery-b@example.test").put("password","fixture-password").put("deviceId",Json.id()),200);
            }
        } finally {mail.stop();}
    }
    private void awaitMarker(Process process,Path marker,Path log) throws Exception {
        long deadline=System.nanoTime()+java.time.Duration.ofSeconds(90).toNanos();
        while(process.isAlive()&&!Files.exists(marker)&&System.nanoTime()<deadline) Thread.sleep(20);
        assertThat(Files.exists(marker)).as(Files.exists(log)?Files.readString(log):"missing integration log").isTrue();
    }
    private void importArchive(PostgreSQLContainer target,Path dump) throws Exception {
        target.start();provision(target);scripts(target);
        target.copyFileToContainer(MountableFile.forHostPath(dump),"/tmp/source.dump");
        target.copyFileToContainer(MountableFile.forHostPath(dump+".sha256"),"/tmp/source.dump.sha256");
        succeeds(target,"sh","/tmp/restore.sh","/tmp/source.dump");
    }
    @Test @Timeout(300) void mobileKeepsPostCutConfirmationsWhileHistoricalCopyIsQuarantinedAndResumesOnlyAfterIntegralRecovery() throws Exception {
        var directory=Files.createTempDirectory(Path.of("build"),"operational-recovery-").toAbsolutePath();
        var old=directory.resolve("old.dump");var full=directory.resolve("full.dump");
        var log=Path.of("build/operational-recovery-integration.log");Process process=null;
        var rotated=Base64.getEncoder().encodeToString("11111111111111111111111111111111".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        try(var source=new PostgreSQLContainer(IMAGE).withUsername("source_owner");
            var historical=new PostgreSQLContainer(IMAGE).withUsername("historical_owner");
            var target=new PostgreSQLContainer(IMAGE).withUsername("restore_owner")) {
            source.start();provision(source);scripts(source);
            try(var api=startApi(source)) {
                var builder=new ProcessBuilder("node","--import","tsx","--test","test/integration/operational-recovery.test.ts")
                    .directory(Path.of("../app").toFile()).redirectErrorStream(true).redirectOutput(log.toFile());
                builder.environment().put("RITMO_TEST_API",api.origin());builder.environment().put("RITMO_RECOVERY_DIRECTORY",directory.toString());
                process=builder.start();awaitMarker(process,directory.resolve("cut-ready"),log);
                succeeds(source,"sh","/tmp/backup.sh","/tmp/old.dump");
                source.copyFileFromContainer("/tmp/old.dump",old.toString());source.copyFileFromContainer("/tmp/old.dump.sha256",old+".sha256");
                Files.writeString(directory.resolve("advance"),"ready");awaitMarker(process,directory.resolve("complete-ready"),log);
            }
            succeeds(source,"sh","/tmp/backup.sh","/tmp/full.dump");
            source.copyFileFromContainer("/tmp/full.dump",full.toString());source.copyFileFromContainer("/tmp/full.dump.sha256",full+".sha256");source.stop();
            importArchive(historical,old);
            try(var api=startApi(historical,Map.of("ritmo.operations.quarantined","true","ritmo.signing-key",rotated))) {
                Files.writeString(directory.resolve("release"),"quarantine\n"+api.origin());
                awaitMarker(process,directory.resolve("quarantine-checked"),log);
            }
            historical.stop();importArchive(target,full);
            succeeds(target,"env","RITMO_RECOVERY_QUARANTINE=true","RITMO_RECOVERY_VERIFIED=true","sh","/tmp/prepare-recovery.sh");
            try(var api=startApi(target,Map.of("ritmo.signing-key",rotated))) {
                Files.writeString(directory.resolve("release"),"active\n"+api.origin());
                assertThat(process.waitFor(90,java.util.concurrent.TimeUnit.SECONDS)).as(Files.readString(log)).isTrue();
                assertThat(process.exitValue()).as(Files.readString(log)).isZero();System.out.println(Files.readString(log));
            }
        } finally {
            if(process!=null&&process.isAlive()) process.destroyForcibly().waitFor();
            try(var files=Files.list(directory)) {for(var file:files.toList()) Files.delete(file);}
            Files.delete(directory);
        }
    }
    @Test @Timeout(180) void anArchiveRestoresAccountsHabitsXpReceiptsAndIsolationIntoACleanServer() throws Exception {
        var dump=Files.createTempFile("ritmo-restore-",".dump");
        try(var source=new PostgreSQLContainer(IMAGE).withUsername("source_owner");var target=new PostgreSQLContainer(IMAGE).withUsername("restore_owner")) {
            source.start();provision(source);
            JsonNode account,other,created,manifest;String token;
            try(var api=startApi(source)) {
                account=registration(api,"restore@example.test");other=registration(api,"other@example.test");token=account.path("accessToken").asString();
                created=operation(1,create(Json.id()));
                var mark=Json.object().put("type","habit.mark").put("habitId",created.at("/command/habitId").asString()).put("dayKey","2026-09-25");
                mark.set("timeContext",created.at("/command/timeContext"));mark.set("observedUndoIds",Json.array());
                assertThat(push(api,token,created,operation(2,mark)).at("/results/1/receipt/status").asString()).isEqualTo("accepted");
                manifest=post(api,"sync/snapshots",token,Json.object(),201);
            }
            scripts(source);succeeds(source,"sh","/tmp/backup.sh","/tmp/source.dump");
            refuses(source,"backup_destination_exists","sh","/tmp/backup.sh","/tmp/source.dump");
            assertThat(command(source,"env","PGUSER=app_domain","PGPASSWORD=fixture-domain","sh","/tmp/backup.sh","/tmp/incomplete.dump").getExitCode()).isNotZero();
            source.copyFileFromContainer("/tmp/source.dump",dump.toString());
            source.copyFileFromContainer("/tmp/source.dump.sha256",dump+".sha256");source.stop();
            target.start();scripts(target);
            target.copyFileToContainer(MountableFile.forHostPath(dump),"/tmp/source.dump");
            target.copyFileToContainer(MountableFile.forHostPath(dump+".sha256"),"/tmp/source.dump.sha256");
            // No global roles exist yet: restore must fail and roll back its schema/data changes.
            assertThat(command(target,"sh","/tmp/restore.sh","/tmp/source.dump").getExitCode()).isNotZero();
            provision(target);succeeds(target,"sh","/tmp/restore.sh","/tmp/source.dump");
            try(var restored=startApi(target)) {
                var entities=page(restored,token,manifest,200).path("entities");
                assertThat(entities).anySatisfy(entity->{assertThat(entity.path("kind").asString()).isEqualTo("habitDay");assertThat(entity.at("/value/done").asBoolean()).isTrue();});
                assertThat(entities).anySatisfy(entity->{assertThat(entity.path("kind").asString()).isEqualTo("xpGrant");assertThat(entity.at("/value/amount").asInt()).isEqualTo(10);assertThat(entity.at("/value/active").asBoolean()).isTrue();});
                refuses(target,"restore_requires_empty_database","sh","/tmp/restore.sh","/tmp/source.dump");
                succeeds(target,"sh","-c","printf corrupt > /tmp/bad.dump; cp /tmp/source.dump.sha256 /tmp/bad.dump.sha256");
                refuses(target,"backup_checksum_mismatch","sh","/tmp/restore.sh","/tmp/bad.dump");
                assertThat(push(restored,token,created).at("/results/0/replayed").asBoolean()).isTrue();
                var current=post(restored,"sync/snapshots",token,Json.object(),201);
                assertThat(current.path("highWaterRevision").asString()).isEqualTo("2");
                assertThat(page(restored,token,current,200).path("entities")).isEqualTo(entities);
                assertThat(page(restored,other.path("accessToken").asString(),manifest,404).at("/error/code").asString()).isEqualTo("resource_inaccessible");
                var refreshed=post(restored,"auth/refresh",null,Json.object().put("refreshToken",account.path("refreshToken").asString()),200);
                post(restored,"auth/revoke",null,Json.object().put("revokeToken",account.path("revokeToken").asString()),204);
                post(restored,"auth/refresh",null,Json.object().put("refreshToken",refreshed.path("refreshToken").asString()),401);
            }
        } finally {Files.deleteIfExists(dump);Files.deleteIfExists(Path.of(dump+".sha256"));}
    }
    @Test @Timeout(180) void restoredApiReconcilesOfflineSqliteWorkAndPreservesDeletedIds() throws Exception {
        var directory=Files.createTempDirectory(Path.of("build"),"restore-mobile-").toAbsolutePath();
        var ready=directory.resolve("ready");var release=directory.resolve("release");
        var dump=directory.resolve("source.dump");var log=Path.of("build/restore-mobile-integration.log");
        Process process=null;
        try(var source=new PostgreSQLContainer(IMAGE).withUsername("source_owner");var target=new PostgreSQLContainer(IMAGE).withUsername("restore_owner")) {
            source.start();provision(source);
            try(var api=startApi(source)) {
                var builder=new ProcessBuilder("node","--import","tsx","--test","test/integration/restore.test.ts")
                    .directory(Path.of("../app").toFile()).redirectErrorStream(true).redirectOutput(log.toFile());
                builder.environment().put("RITMO_TEST_API",api.origin());builder.environment().put("RITMO_RESTORE_READY",ready.toString());builder.environment().put("RITMO_RESTORE_RELEASE",release.toString());
                process=builder.start();long deadline=System.nanoTime()+java.time.Duration.ofSeconds(45).toNanos();
                while(process.isAlive()&&!Files.exists(ready)&&System.nanoTime()<deadline) Thread.sleep(10);
                assertThat(Files.exists(ready)).as(Files.readString(log)).isTrue();
            }
            scripts(source);succeeds(source,"sh","/tmp/backup.sh","/tmp/source.dump");
            source.copyFileFromContainer("/tmp/source.dump",dump.toString());source.copyFileFromContainer("/tmp/source.dump.sha256",dump+".sha256");source.stop();
            target.start();provision(target);scripts(target);
            target.copyFileToContainer(MountableFile.forHostPath(dump),"/tmp/source.dump");target.copyFileToContainer(MountableFile.forHostPath(dump+".sha256"),"/tmp/source.dump.sha256");
            succeeds(target,"sh","/tmp/restore.sh","/tmp/source.dump");
            try(var restored=startApi(target)) {
                Files.writeString(release,restored.origin());
                assertThat(process.waitFor(60,java.util.concurrent.TimeUnit.SECONDS)).as(Files.readString(log)).isTrue();
                assertThat(process.exitValue()).as(Files.readString(log)).isZero();
                System.out.println(Files.readString(log));
            }
        } finally {
            if(process!=null&&process.isAlive()) process.destroyForcibly().waitFor();
            for(var file:List.of(ready,release,dump,Path.of(dump+".sha256"))) Files.deleteIfExists(file);
            Files.delete(directory);
        }
    }

}
