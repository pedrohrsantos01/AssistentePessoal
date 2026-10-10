package dev.ritmo;

import java.net.URI;
import java.net.http.*;
import java.util.*;
import java.sql.DriverManager;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.Network;
import org.awaitility.Awaitility;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.MountableFile;
import dev.ritmo.shared.Json;
import tools.jackson.databind.JsonNode;
import static org.assertj.core.api.Assertions.assertThat;

class WalRecoveryTests {
    private static final String IMAGE="postgres@sha256:5a5a84b19854a9ffaa54082c166ff4ec27473a361e496e5ea167f298f2da9722";
    private final HttpClient http=HttpClient.newHttpClient();
    private record Api(ConfigurableApplicationContext context,String origin) implements AutoCloseable {
        @Override public void close() {context.close();}
    }
    private Api startApi(String url,String owner,String password,Map<String,String> overrides) {
        var settings=new LinkedHashMap<String,String>();
        settings.put("server.port","0");settings.put("server.address","127.0.0.1");settings.put("logging.level.root","ERROR");
        settings.put("spring.datasource.url",url);settings.put("spring.datasource.username","app_domain");settings.put("spring.datasource.password","fixture-domain");
        settings.put("spring.flyway.url",url);settings.put("spring.flyway.user",owner);settings.put("spring.flyway.password",password);
        settings.put("ritmo.identity.url",url);settings.put("ritmo.identity.username","app_identity");settings.put("ritmo.identity.password","fixture-identity");
        settings.put("ritmo.signing-key",Base64.getEncoder().encodeToString(new byte[32]));settings.put("spring.mail.host","127.0.0.1");
        settings.put("ritmo.operations.require-wal", "true");settings.put("ritmo.operations.wal-wait-ms", "250");settings.putAll(overrides);
        var context=new SpringApplicationBuilder(RitmoApplication.class).run(settings.entrySet().stream().map(e->"--"+e.getKey()+"="+e.getValue()).toArray(String[]::new));
        return new Api(context,"http://127.0.0.1:"+context.getEnvironment().getRequiredProperty("local.server.port",Integer.class));
    }
    private void provision(PostgreSQLContainer db) throws Exception {
        db.copyFileToContainer(MountableFile.forHostPath("ops/bootstrap-roles.sql"),"/tmp/bootstrap-roles.sql");
        var result=db.execInContainer("env","PGPASSWORD="+db.getPassword(),"psql","-h","127.0.0.1","-U",db.getUsername(),"-d",db.getDatabaseName(),"-v","ON_ERROR_STOP=1","-f","/tmp/bootstrap-roles.sql","-c","""
            CREATE ROLE app_domain LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'fixture-domain';
            CREATE ROLE app_identity LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'fixture-identity';
            GRANT ritmo_domain TO app_domain; GRANT ritmo_identity TO app_identity;
            """);
        assertThat(result.getExitCode()).as(result.getStderr()).isZero();
    }
    private JsonNode post(Api api,String path,String token,JsonNode body,int expected) throws Exception {
        var request=HttpRequest.newBuilder(URI.create(api.origin()+"/api/v1/"+path)).timeout(java.time.Duration.ofSeconds(20))
            .header("Content-Type","application/json").header("X-Ritmo-Protocol","m1.1").header("X-App-Version","0.1.0").header("Idempotency-Key",Json.id());
        if(token!=null) request.header("Authorization","Bearer "+token);
        var response=http.send(request.POST(HttpRequest.BodyPublishers.ofString(body.toString())).build(),HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(path).isEqualTo(expected);return response.body().isEmpty()?Json.object():Json.read(response.body());
    }
    private JsonNode registration(String email) {
        return Json.object().put("email",email).put("password","fixture-password").put("displayName","WAL fixture").put("deviceId",Json.id());
    }
    @Test @Timeout(90)
    void protectedApiDoesNotAcceptWritesWithoutAnIndependentSynchronousReceiver() throws Exception {
        try(var db=new PostgreSQLContainer(IMAGE).withCommand("postgres","-c","fsync=on","-c","full_page_writes=on","-c","synchronous_commit=on")) {
            db.start();provision(db);
            try(var api=startApi(db.getJdbcUrl(),db.getUsername(),db.getPassword(),Map.of())) {
                assertThat(post(api,"auth/register",null,registration("absent@example.test"),503).at("/error/code").asString()).isEqualTo("temporarily_unavailable");
            }
        }
    }
    private String sql(PostgreSQLContainer db,String statement) throws Exception {
        var result=db.execInContainer("env","PGPASSWORD="+db.getPassword(),"psql","-h","127.0.0.1","-U",db.getUsername(),"-d",db.getDatabaseName(),"-XAt","-v","ON_ERROR_STOP=1","-c",statement);
        assertThat(result.getExitCode()).as(result.getStderr()).isZero();return result.getStdout().trim();
    }
    private String metadata(PostgreSQLContainer db,String query) throws Exception {
        try(var connection=DriverManager.getConnection(db.getJdbcUrl(),db.getUsername(),db.getPassword());var statement=connection.createStatement()) {
            statement.setQueryTimeout(3);try(var result=statement.executeQuery(query)) {assertThat(result.next()).isTrue();return result.getString(1);}
        }
    }
    private String succeed(GenericContainer<?> container,String... command) throws Exception {
        var result=container.execInContainer(command);assertThat(result.getExitCode()).as(result.getStderr()).isZero();return result.getStdout();
    }
    private GenericContainer<?> receiver(Network network) {
        return new GenericContainer<>(IMAGE).withNetwork(network).withCommand("sh","-c","exec sleep infinity")
            .withCreateContainerCmdModifier(command->command.withUser("postgres"))
            .withEnv("PGHOST","primary").withEnv("PGUSER","ritmo_wal_receiver").withEnv("PGPASSWORD","fixture-wal")
            .withEnv("PGAPPNAME","ritmo_wal").withEnv("PGDATABASE","test")
            .withCopyFileToContainer(MountableFile.forHostPath("ops/receive-wal.sh"),"/tmp/receive-wal.sh");
    }
    private void startReceiver(GenericContainer<?> receiver) throws Exception {
        succeed(receiver,"sh","-c","mkdir -p /tmp/archive/wal; (exec sh /tmp/receive-wal.sh /tmp/archive/wal > /tmp/receiver.log 2>&1) & echo $! > /tmp/receiver.pid");
    }
    private void stopReceiver(GenericContainer<?> receiver) throws Exception {
        succeed(receiver,"sh","-c","kill -TERM $(cat /tmp/receiver.pid)");
    }
    private void configureWal(PostgreSQLContainer db) throws Exception {
        sql(db,"CREATE ROLE ritmo_wal_receiver LOGIN REPLICATION NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'fixture-wal'");
        sql(db,"SELECT pg_create_physical_replication_slot('ritmo_wal',true)");
        sql(db,"ALTER ROLE app_domain SET statement_timeout='5s'");
        sql(db,"ALTER SYSTEM SET synchronous_standby_names='FIRST 1 (ritmo_wal)'");
        succeed(db,"sh","-c","printf '\nhost replication ritmo_wal_receiver 0.0.0.0/0 scram-sha-256\n' >> \"$PGDATA/pg_hba.conf\"");
        sql(db,"SELECT pg_reload_conf()");
    }
    private void awaitFlush(PostgreSQLContainer db,GenericContainer<?> receiver) throws Exception {
        awaitFlush(db,db.getUsername(),db.getPassword(),receiver);
    }
    private void awaitFlush(GenericContainer<?> db,String owner,String password,GenericContainer<?> receiver) throws Exception {
        // Keep one barrier as the API does; a fresh marker on every poll races the receiver.
        String position=sql(db,owner,password,"SELECT public.ritmo_wal_status(null)->>'position'");
        try {Awaitility.await().atMost(Duration.ofSeconds(15)).until(()->sql(db,owner,password,"SELECT public.ritmo_wal_status('"+position+"'::pg_lsn)->>'durable'").equals("true"));}
        catch(org.awaitility.core.ConditionTimeoutException e) {
            throw new AssertionError(receiver.execInContainer("cat","/tmp/receiver.log").getStdout()+sql(db,owner,password,"SELECT json_build_object('setting',current_setting('synchronous_standby_names'),'status',public.ritmo_wal_status('"+position+"'::pg_lsn),'receivers',(select json_agg(json_build_object('user',usename,'name',application_name,'flush',flush_lsn,'state',sync_state)) from pg_stat_replication))"),e);
        }
    }
    private JsonNode operation(String device,int sequence,JsonNode command) {
        var operation=Json.object().put("operationId",Json.id()).put("deviceId",device).put("clientSequence",sequence)
            .put("occurredAt",java.time.Instant.now().toString());
        operation.set("dependsOn",Json.array());
        operation.set("command",command);return operation;
    }
    private JsonNode onboarding() {
        var command=Json.object().put("type","profile.setOnboarding").put("completed",true).put("analyticsConsent",false);
        command.set("timeContext",Json.object().put("timezone","UTC").put("dayStartHour",4));return command;
    }
    @Test @Timeout(180)
    void canceledOrTimedOutSynchronousCommitAndItsReceiptStayUnavailableUntilRemoteFlush() throws Exception {
        try(var network=Network.newNetwork();var db=new PostgreSQLContainer(IMAGE).withCommand("postgres","-c","fsync=on","-c","full_page_writes=on","-c","synchronous_commit=on").withNetwork(network).withNetworkAliases("primary");var receiver=receiver(network)) {
            db.start();provision(db);
            try(var initial=startApi(db.getJdbcUrl(),db.getUsername(),db.getPassword(),Map.of("ritmo.operations.require-wal","false"))) {assertThat(initial.origin()).isNotBlank();}
            configureWal(db);receiver.start();startReceiver(receiver);awaitFlush(db,receiver);
            String timedUrl=db.getJdbcUrl()+(db.getJdbcUrl().contains("?")?"&":"?")+"socketTimeout=3";
            try(var api=startApi(timedUrl,db.getUsername(),db.getPassword(),Map.of())) {
                sql(db,"CREATE ROLE wal_guard_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE");
                sql(db,"ALTER FUNCTION public.ritmo_wal_status(pg_lsn) OWNER TO wal_guard_owner");
                post(api,"auth/register",null,registration("hidden-stats@example.test"),503);
                sql(db,"GRANT pg_read_all_stats TO wal_guard_owner");
                assertThat(metadata(db,"SELECT bool_and(NOT rolsuper AND NOT rolbypassrls AND NOT rolreplication) FROM pg_roles WHERE rolname IN ('app_domain','app_identity','wal_guard_owner')")).isEqualTo("t");
                assertThat(metadata(db,"SELECT pg_has_role('app_domain','pg_read_all_stats','MEMBER') OR pg_has_role('app_identity','pg_read_all_stats','MEMBER')")).isEqualTo("f");
                var account=post(api,"auth/register",null,registration("cancel@example.test"),201);String token=account.path("accessToken").asString();
                var before=post(api,"sync/snapshots",token,Json.object(),201);var beforePage=page(api,token,before);
                for(int scenario=1;scenario<=2;scenario++) {
                    var op=operation(Json.id(),1,onboarding());
                    var body=Json.object();body.set("operations",Json.array().add(op));
                    try(var fault=DriverManager.getConnection(db.getJdbcUrl(),db.getUsername(),db.getPassword());var statement=fault.createStatement()) {
                        fault.setAutoCommit(false);statement.execute("SET LOCAL synchronous_commit=local");statement.execute("LOCK TABLE sync_account_state IN ACCESS EXCLUSIVE MODE");sql(db,"CHECKPOINT");
                        var request=HttpRequest.newBuilder(URI.create(api.origin()+"/api/v1/sync/push"))
                            .header("Authorization","Bearer "+token).header("Content-Type","application/json")
                            .header("X-Ritmo-Protocol","m1.1").header("X-App-Version","0.1.0").header("Idempotency-Key",Json.id())
                            .POST(HttpRequest.BodyPublishers.ofString(body.toString())).build();
                        var pending=http.sendAsync(request,HttpResponse.BodyHandlers.ofString());
                        Awaitility.await().atMost(Duration.ofSeconds(10)).until(()->metadata(db,"SELECT count(*) FROM pg_stat_activity WHERE usename='app_domain' AND wait_event_type='Lock'").equals("1"));
                        stopReceiver(receiver);fault.commit();
                        Awaitility.await().atMost(Duration.ofSeconds(10)).until(()->metadata(db,"SELECT count(*) FROM pg_stat_activity WHERE usename='app_domain' AND wait_event='SyncRep'").equals("1"));
                        assertThat(pending.isDone()).isFalse();
                        if(scenario==1) metadata(db,"SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE usename='app_domain' AND wait_event='SyncRep'");
                        var response=pending.get(10,java.util.concurrent.TimeUnit.SECONDS);
                        assertThat(response.statusCode()).isEqualTo(503);
                        assertThat(Json.read(response.body()).at("/error/code").asString()).isEqualTo("temporarily_unavailable");
                    }
                    post(api,"sync/push",token,body,503);
                    post(api,"sync/receipts",token,Json.object().put("snapshotId",before.path("snapshotId").asString()).set("operationIds",Json.array().add(op.path("operationId"))),503);
                    post(api,"sync/snapshots",token,Json.object(),503);
                    for(String route:List.of("sync/pull?cursor="+beforePage.path("pullCursor").asString(),
                        "sync/snapshots/"+before.path("snapshotId").asString()+"?cursor="+before.path("firstPageCursor").asString())) {
                        var get=HttpRequest.newBuilder(URI.create(api.origin()+"/api/v1/"+route)).header("Authorization","Bearer "+token)
                            .header("X-Ritmo-Protocol","m1.1").header("X-App-Version","0.1.0").GET().build();
                        var unavailable=http.send(get,HttpResponse.BodyHandlers.ofString());assertThat(unavailable.statusCode()).isEqualTo(503);
                        assertThat(Json.read(unavailable.body()).has("entities")).isFalse();
                    }
                    // Public replay proves the canceled wait committed locally, but was not falsely acknowledged.
                    startReceiver(receiver);awaitFlush(db,receiver);
                    var replay=post(api,"sync/push",token,body,200);
                    assertThat(replay.at("/results/0/replayed").asBoolean()).isTrue();
                    assertThat(replay.at("/results/0/receipt/status").asString()).isEqualTo("accepted");
                    assertThat(post(api,"sync/snapshots",token,Json.object(),201).path("highWaterRevision").asString()).isEqualTo(Integer.toString(scenario));
                }
            }
        }
    }

    private JsonNode push(Api api,String token,JsonNode... operations) throws Exception {
        var body=Json.object();var list=Json.array();for(var operation:operations) list.add(operation);body.set("operations",list);
        var result=post(api,"sync/push",token,body,200);
        for(var item:result.path("results")) assertThat(item.at("/receipt/status").asString()).as(item.path("receipt").toString()).isEqualTo("accepted");return result;
    }
    private JsonNode markCommand(String habit,String day) {
        var command=Json.object().put("type","habit.mark").put("habitId",habit).put("dayKey",day);
        command.set("timeContext",Json.object().put("timezone","UTC").put("dayStartHour",4));command.set("observedUndoIds",Json.array());return command;
    }
    private JsonNode create(String habit,String day) {
        var command=Json.object().put("type","habit.create").put("habitId",habit).put("title","Physical restore "+habit)
            .put("habitType","binary").put("scheduleKind","daily").put("startDayKey",day).put("sortOrder",0);
        command.set("timeContext",Json.object().put("timezone","UTC").put("dayStartHour",4));command.putNull("iconKey");command.putNull("colorToken");return command;
    }
    private JsonNode page(Api api,String token,JsonNode manifest) throws Exception {
        var request=HttpRequest.newBuilder(URI.create(api.origin()+"/api/v1/sync/snapshots/"+manifest.path("snapshotId").asString()+"?cursor="+manifest.path("firstPageCursor").asString()))
            .header("Authorization","Bearer "+token).header("X-Ritmo-Protocol","m1.1").header("X-App-Version","0.1.0").GET().build();
        var response=http.send(request,HttpResponse.BodyHandlers.ofString());assertThat(response.statusCode()).isEqualTo(200);return Json.read(response.body());
    }
    private String sql(GenericContainer<?> db,String owner,String password,String statement) throws Exception {
        var result=db.execInContainer("env","PGPASSWORD="+password,"psql","-h","127.0.0.1","-U",owner,"-d","test","-XAt","-v","ON_ERROR_STOP=1","-c",statement);
        assertThat(result.getExitCode()).as(result.getStderr()).isZero();return result.getStdout().trim();
    }
    private GenericContainer<?> recoveryTarget(Network network,java.nio.file.Path archive) {
        return new GenericContainer<>(IMAGE).withNetwork(network).withNetworkAliases("primary").withExposedPorts(5432)
            .withCreateContainerCmdModifier(command->command.withUser("postgres"))
            .withCommand("sh","-c","echo fixture-ready; exec sleep infinity")
            .waitingFor(org.testcontainers.containers.wait.strategy.Wait.forLogMessage(".*fixture-ready.*",1))
            .withCopyFileToContainer(MountableFile.forHostPath(archive),"/tmp/archive.tar")
            .withCopyFileToContainer(MountableFile.forHostPath("ops/restore-physical.sh"),"/tmp/restore-physical.sh")
            .withCopyFileToContainer(MountableFile.forHostPath("ops/select-wal-target.sh"),"/tmp/select-wal-target.sh")
            .withCopyFileToContainer(MountableFile.forHostPath("ops/prepare-recovery.sh"),"/tmp/prepare-recovery.sh")
            .withCopyFileToContainer(MountableFile.forHostPath("ops/prepare-recovery.sql"),"/tmp/prepare-recovery.sql");
    }
    private java.math.BigInteger lsnNumber(String value) {
        var pieces=value.split("/");return new java.math.BigInteger(pieces[0],16).shiftLeft(32).add(new java.math.BigInteger(pieces[1],16));
    }
    private String refuseIncomplete(GenericContainer<?> target,String directory,String wal,String lsn) throws Exception {
        succeed(target,"env","RITMO_RECOVERY_QUARANTINE=true","sh","/tmp/restore-physical.sh","/tmp/archive/base",wal,directory,lsn,"1");
        target.execInContainer("pg_ctl","-D",directory,"-l",directory+".log","-w","start");
        Awaitility.await().atMost(Duration.ofSeconds(15)).until(()->target.execInContainer("pg_ctl","-D",directory,"status").getExitCode()!=0);
        var log=target.execInContainer("cat",directory+".log").getStdout();
        assertThat(log).contains("recovery ended before configured recovery target was reached");return log;
    }
    @Test @Timeout(420)
    void independentPhysicalBaseAndPartialWalRestorePostBaseConfirmationsAfterPrimaryLoss() throws Exception {
        var mail=new com.icegreen.greenmail.util.GreenMail(new com.icegreen.greenmail.util.ServerSetup(0,"127.0.0.1","smtp"));mail.start();
        var archive=java.nio.file.Files.createTempFile(java.nio.file.Path.of("build"),"wal-recovery-",".tar");
        try(var network=Network.newNetwork();var db=new PostgreSQLContainer(IMAGE).withCommand("postgres","-c","fsync=on","-c","full_page_writes=on","-c","synchronous_commit=on").withNetwork(network).withNetworkAliases("primary");var receiver=receiver(network)) {
            db.start();provision(db);String owner=db.getUsername(),password=db.getPassword();
            try(var initial=startApi(db.getJdbcUrl(),owner,password,Map.of("ritmo.operations.require-wal","false"))) {assertThat(initial.origin()).isNotBlank();}
            configureWal(db);receiver.start();startReceiver(receiver);awaitFlush(db,receiver);
            receiver.copyFileToContainer(MountableFile.forHostPath("ops/physical-base.sh"),"/tmp/physical-base.sh");
            succeed(receiver,"sh","/tmp/physical-base.sh","/tmp/archive/base");succeed(receiver,"test","-f","/tmp/archive/base/backup_manifest");awaitFlush(db,receiver);
            JsonNode a,b,mark,deleted;String target,segment;String device=Json.id(),h1=Json.id(),h2=Json.id();
            String day=java.time.Instant.now().minusSeconds(4*3600).atZone(java.time.ZoneOffset.UTC).toLocalDate().toString();
            // Restoration correctness uses the normal production WAL budget; fault fixtures retain 250 ms.
            var smtp=Map.of("ritmo.operations.wal-wait-ms","2000","spring.mail.port",Integer.toString(mail.getSmtp().getPort()),"spring.mail.properties.mail.smtp.auth","false",
                "spring.mail.properties.mail.smtp.starttls.required","false","spring.mail.properties.mail.smtp.starttls.enable","false",
                "ritmo.recovery.origin","https://api.example.test","ritmo.recovery.from","no-reply@example.test");
            try(var api=startApi(db.getJdbcUrl(),owner,password,smtp)) {
                a=post(api,"auth/register",null,registration("wal-a@example.test"),201);String token=a.path("accessToken").asString();
                push(api,token,operation(device,1,onboarding()),operation(device,2,create(h1,day)),
                    operation(device,3,markCommand(h1,day)));
                sql(db,"SELECT pg_switch_wal()");awaitFlush(db,receiver);
                b=post(api,"auth/register",null,registration("wal-b@example.test"),201);
                mark=operation(device,5,markCommand(h2,day));
                deleted=operation(device,6,Json.object().put("type","habit.delete").put("habitId",h1));
                push(api,token,operation(device,4,create(h2,day)),mark,deleted);
                assertThat(post(api,"sync/snapshots",token,Json.object(),201).path("highWaterRevision").asString()).isEqualTo("6");
                post(api,"auth/password-reset/request",null,Json.object().put("email","wal-a@example.test"),202);
                Awaitility.await().atMost(Duration.ofSeconds(10)).until(()->mail.getReceivedMessages().length==1);
                String reset;
                try(var input=mail.getReceivedMessages()[0].getInputStream()) {
                    var match=java.util.regex.Pattern.compile("token=([A-Za-z0-9_-]{43})").matcher(new String(input.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8));
                    assertThat(match.find()).isTrue();reset=match.group(1);
                }
                post(api,"auth/password-reset/confirm",null,Json.object().put("resetToken",reset).put("newPassword","fixture-new-password"),204);
                target=sql(db,"SELECT pg_create_restore_point('fixture_after_confirmations')");awaitFlush(db,receiver);
                segment=sql(db,"SELECT pg_walfile_name('"+target+"'::pg_lsn)");
                succeed(receiver,"test","-f","/tmp/archive/wal/"+segment+".partial");
            }
            // Abrupt host loss: no final checkpoint, archive or source-disk copy.
            db.getDockerClient().killContainerCmd(db.getContainerId()).withSignal("KILL").exec();db.stop();stopReceiver(receiver);
            succeed(receiver,"tar","-cf","/tmp/archive.tar","-C","/tmp/archive",".");receiver.copyFileFromContainer("/tmp/archive.tar",archive.toString());
            try(var restored=recoveryTarget(network,archive)) {
                restored.start();succeed(restored,"sh","-c","mkdir /tmp/archive; tar -xf /tmp/archive.tar -C /tmp/archive");
                succeed(restored,"sh","-c","cp -R /tmp/archive/base /tmp/bad-base; printf corrupt >> /tmp/bad-base/PG_VERSION");
                var badBase=restored.execInContainer("env","RITMO_RECOVERY_QUARANTINE=true","sh","/tmp/restore-physical.sh","/tmp/bad-base","/tmp/archive/wal","/tmp/refused",target,"1");
                assertThat(badBase.getExitCode()).isNotZero();succeed(restored,"test","!","-e","/tmp/refused");
                succeed(restored,"cp","-R","/tmp/archive/wal","/tmp/gap-wal");
                succeed(restored,"mv","/tmp/gap-wal/"+segment+".partial","/tmp/missing-tail.partial");
                refuseIncomplete(restored,"/tmp/gap","/tmp/gap-wal",target);
                succeed(restored,"cp","-R","/tmp/archive/wal","/tmp/corrupt-wal");
                succeed(restored,"sh","-c","printf X | dd of=/tmp/corrupt-wal/"+segment+".partial bs=1 seek=0 count=1 conv=notrunc 2>/dev/null");
                assertThat(refuseIncomplete(restored,"/tmp/corrupt","/tmp/corrupt-wal",target)).contains("invalid magic number");
                var selected=succeed(restored,"env","RITMO_WAL_FROZEN=true","sh","/tmp/select-wal-target.sh","/tmp/archive/base","/tmp/archive/wal").trim().split(" ");
                String selectedTarget=selected[0];assertThat(selected[1]).isEqualTo("1");
                assertThat(lsnNumber(selectedTarget)).isGreaterThanOrEqualTo(lsnNumber(target));
                succeed(restored,"cp","-R","/tmp/archive/wal","/tmp/nonzero-tail");
                succeed(restored,"sh","-c","printf X | dd of=/tmp/nonzero-tail/"+segment+".partial bs=1 seek=16777215 count=1 conv=notrunc 2>/dev/null");
                for(String damaged:List.of("/tmp/gap-wal","/tmp/corrupt-wal","/tmp/nonzero-tail"))
                    assertThat(restored.execInContainer("env","RITMO_WAL_FROZEN=true","sh","/tmp/select-wal-target.sh","/tmp/archive/base",damaged).getExitCode()).isNotZero();
                succeed(restored,"env","RITMO_RECOVERY_QUARANTINE=true","sh","/tmp/restore-physical.sh","/tmp/archive/base","/tmp/archive/wal","/tmp/recovered",selectedTarget,"1");
                succeed(restored,"pg_ctl","-D","/tmp/recovered","-l","/tmp/recovery.log","-w","start");
                Awaitility.await().atMost(Duration.ofSeconds(15)).until(()->sql(restored,owner,password,"SELECT pg_is_wal_replay_paused() AND pg_last_wal_replay_lsn()>='"+target+"'::pg_lsn").equals("t"));
                sql(restored,owner,password,"SELECT pg_wal_replay_resume()");
                Awaitility.await().atMost(Duration.ofSeconds(10)).until(()->sql(restored,owner,password,"SELECT NOT pg_is_in_recovery()").equals("t"));
                succeed(restored,"env","PGHOST=127.0.0.1","PGDATABASE=test","PGUSER="+owner,"PGPASSWORD="+password,
                    "RITMO_RECOVERY_QUARANTINE=true","RITMO_RECOVERY_VERIFIED=true","sh","/tmp/prepare-recovery.sh");
                sql(restored,owner,password,"SELECT pg_create_physical_replication_slot('ritmo_wal',true)");startReceiver(receiver);
                sql(restored,owner,password,"ALTER SYSTEM SET synchronous_standby_names='FIRST 1 (ritmo_wal)'");sql(restored,owner,password,"SELECT pg_reload_conf()");
                awaitFlush(restored,owner,password,receiver);
                String secondTarget;String secondDevice=Json.id();JsonNode secondOp;
                String url="jdbc:postgresql://"+restored.getHost()+":"+restored.getMappedPort(5432)+"/test";
                try(var api=startApi(url,owner,password,Map.of("ritmo.operations.wal-wait-ms","2000","ritmo.signing-key",Base64.getEncoder().encodeToString("wal-recovery-key-32-bytes-exactly!".getBytes(java.nio.charset.StandardCharsets.UTF_8))))) {
                    post(api,"auth/login",null,Json.object().put("email","wal-a@example.test").put("password","fixture-password").put("deviceId",device),401);
                    post(api,"auth/refresh",null,Json.object().put("refreshToken",a.path("refreshToken").asString()),401);
                    post(api,"auth/refresh",null,Json.object().put("refreshToken",b.path("refreshToken").asString()),401);
                    var login=post(api,"auth/login",null,Json.object().put("email","wal-a@example.test").put("password","fixture-new-password").put("deviceId",device),200);
                    assertThat(login.path("accountId").asString()).isEqualTo(a.path("accountId").asString());String token=login.path("accessToken").asString();
                    var snapshot=post(api,"sync/snapshots",token,Json.object(),201);assertThat(snapshot.path("highWaterRevision").asString()).isEqualTo("6");
                    var entities=page(api,token,snapshot).path("entities");
                    assertThat(entities.valueStream().filter(e->e.path("kind").asString().equals("habit")).count()).isEqualTo(1);
                    assertThat(entities.valueStream().filter(e->e.path("kind").asString().equals("tombstone")).count()).isEqualTo(1);
                    assertThat(entities.valueStream().filter(e->e.path("kind").asString().equals("xpGrant")&&e.at("/value/active").asBoolean()).mapToInt(e->e.at("/value/amount").asInt()).sum()).isEqualTo(10);
                    var replay=push(api,token,mark,deleted);assertThat(replay.at("/results/0/replayed").asBoolean()).isTrue();assertThat(replay.at("/results/1/replayed").asBoolean()).isTrue();
                    assertThat(post(api,"sync/snapshots",token,Json.object(),201).path("highWaterRevision").asString()).isEqualTo("6");
                    var loginB=post(api,"auth/login",null,Json.object().put("email","wal-b@example.test").put("password","fixture-password").put("deviceId",Json.id()),200);
                    var snapshotB=post(api,"sync/snapshots",loginB.path("accessToken").asString(),Json.object(),201);
                    assertThat(page(api,loginB.path("accessToken").asString(),snapshotB).path("entities").valueStream().filter(e->e.path("kind").asString().equals("habit")).count()).isZero();
                    assertThat(entities.valueStream().filter(e->e.path("kind").asString().equals("xpBudget")).mapToInt(e->e.at("/value/consumed").asInt()).sum()).isEqualTo(20);
                    secondOp=operation(secondDevice,1,onboarding());push(api,token,secondOp);
                    secondTarget=sql(restored,owner,password,"SELECT pg_create_restore_point('fixture_second_timeline')");
                    awaitFlush(restored,owner,password,receiver);
                    succeed(receiver,"test","-f","/tmp/archive/wal/00000002.history");
                }
                // Second loss, original base: recovery must traverse the timeline-1 -> timeline-2 fork.
                succeed(restored,"pg_ctl","-D","/tmp/recovered","-m","immediate","-w","stop");restored.stop();stopReceiver(receiver);
                succeed(receiver,"tar","-cf","/tmp/archive.tar","-C","/tmp/archive",".");receiver.copyFileFromContainer("/tmp/archive.tar",archive.toString());
                try(var second=recoveryTarget(network,archive)) {
                    second.start();succeed(second,"sh","-c","mkdir /tmp/archive; tar -xf /tmp/archive.tar -C /tmp/archive");
                    succeed(second,"cp","-R","/tmp/archive/wal","/tmp/no-history");succeed(second,"rm","/tmp/no-history/00000002.history");
                    assertThat(second.execInContainer("sh","/tmp/select-wal-target.sh","/tmp/archive/base","/tmp/no-history","closed").getExitCode()).isNotZero();
                    succeed(second,"sh","/tmp/select-wal-target.sh","/tmp/archive/base","/tmp/archive/wal","closed");
                    var selectedSecond=succeed(second,"env","RITMO_WAL_FROZEN=true","sh","/tmp/select-wal-target.sh","/tmp/archive/base","/tmp/archive/wal").trim().split(" ");
                    assertThat(selectedSecond[1]).isEqualTo("2");assertThat(lsnNumber(selectedSecond[0])).isGreaterThanOrEqualTo(lsnNumber(secondTarget));
                    succeed(second,"env","RITMO_RECOVERY_QUARANTINE=true","sh","/tmp/restore-physical.sh","/tmp/archive/base","/tmp/archive/wal","/tmp/recovered",selectedSecond[0],"2");
                    succeed(second,"pg_ctl","-D","/tmp/recovered","-l","/tmp/recovery.log","-w","start");
                    Awaitility.await().atMost(Duration.ofSeconds(15)).until(()->sql(second,owner,password,"SELECT pg_is_wal_replay_paused() AND pg_last_wal_replay_lsn()>='"+secondTarget+"'::pg_lsn").equals("t"));
                    sql(second,owner,password,"SELECT pg_wal_replay_resume()");
                    Awaitility.await().atMost(Duration.ofSeconds(10)).until(()->sql(second,owner,password,"SELECT NOT pg_is_in_recovery()").equals("t"));
                    succeed(second,"env","PGHOST=127.0.0.1","PGDATABASE=test","PGUSER="+owner,"PGPASSWORD="+password,
                        "RITMO_RECOVERY_QUARANTINE=true","RITMO_RECOVERY_VERIFIED=true","sh","/tmp/prepare-recovery.sh");
                    sql(second,owner,password,"SELECT pg_create_physical_replication_slot('ritmo_wal',true)");startReceiver(receiver);
                    sql(second,owner,password,"ALTER SYSTEM SET synchronous_standby_names='FIRST 1 (ritmo_wal)'");sql(second,owner,password,"SELECT pg_reload_conf()");
                    awaitFlush(second,owner,password,receiver);
                    var key=new byte[32];Arrays.fill(key,(byte)3);
                    try(var api=startApi("jdbc:postgresql://"+second.getHost()+":"+second.getMappedPort(5432)+"/test",owner,password,Map.of("ritmo.operations.wal-wait-ms","2000","ritmo.signing-key",Base64.getEncoder().encodeToString(key)))) {
                        var login=post(api,"auth/login",null,Json.object().put("email","wal-a@example.test").put("password","fixture-new-password").put("deviceId",secondDevice),200);
                        String token=login.path("accessToken").asString();
                        assertThat(push(api,token,secondOp).at("/results/0/replayed").asBoolean()).isTrue();
                        assertThat(post(api,"sync/snapshots",token,Json.object(),201).path("highWaterRevision").asString()).isEqualTo("7");
                    }
                }
            }
        } finally {mail.stop();java.nio.file.Files.deleteIfExists(archive);}
    }

    @Test @Timeout(90)
    void receiverWithoutStorageCannotAuthorizeApiConfirmations() throws Exception {
        try(var network=Network.newNetwork();var db=new PostgreSQLContainer(IMAGE).withCommand("postgres","-c","fsync=on").withNetwork(network).withNetworkAliases("primary");
            var receiver=receiver(network).withTmpFs(Map.of("/tmp/archive/wal","size=8m,uid=999,gid=999,mode=0700"))) {
            db.start();provision(db);
            try(var initial=startApi(db.getJdbcUrl(),db.getUsername(),db.getPassword(),Map.of("ritmo.operations.require-wal","false"))) {assertThat(initial.origin()).isNotBlank();}
            configureWal(db);receiver.start();startReceiver(receiver);
            Awaitility.await().atMost(Duration.ofSeconds(15)).until(()->receiver.execInContainer("cat","/tmp/receiver.log").getStdout().contains("No space left on device"));
            try(var api=startApi(db.getJdbcUrl(),db.getUsername(),db.getPassword(),Map.of())) {
                assertThat(post(api,"auth/register",null,registration("disk@example.test"),503).at("/error/code").asString()).isEqualTo("temporarily_unavailable");
            }
        }
    }

    @Test @Timeout(120)
    void identityCommitTransportTimeoutDoesNotPublishCredentials() throws Exception {
        try(var network=Network.newNetwork();var db=new PostgreSQLContainer(IMAGE).withCommand("postgres","-c","fsync=on").withNetwork(network).withNetworkAliases("primary");var receiver=receiver(network)) {
            db.start();provision(db);
            try(var initial=startApi(db.getJdbcUrl(),db.getUsername(),db.getPassword(),Map.of("ritmo.operations.require-wal","false"))) {assertThat(initial.origin()).isNotBlank();}
            configureWal(db);receiver.start();startReceiver(receiver);awaitFlush(db,receiver);
            String url=db.getJdbcUrl()+(db.getJdbcUrl().contains("?")?"&":"?")+"socketTimeout=3";
            try(var api=startApi(url,db.getUsername(),db.getPassword(),Map.of())) {
                post(api,"auth/register",null,registration("identity-timeout@example.test"),201);
                var body=Json.object().put("email","identity-timeout@example.test").put("password","fixture-password").put("deviceId",Json.id());
                try(var fault=DriverManager.getConnection(db.getJdbcUrl(),db.getUsername(),db.getPassword());var statement=fault.createStatement()) {
                    fault.setAutoCommit(false);statement.execute("SET LOCAL synchronous_commit=local");statement.execute("LOCK TABLE users IN ACCESS EXCLUSIVE MODE");sql(db,"CHECKPOINT");
                    var request=HttpRequest.newBuilder(URI.create(api.origin()+"/api/v1/auth/login")).header("Content-Type","application/json")
                        .header("X-Ritmo-Protocol","m1.1").header("X-App-Version","0.1.0")
                        .POST(HttpRequest.BodyPublishers.ofString(body.toString())).build();
                    var pending=http.sendAsync(request,HttpResponse.BodyHandlers.ofString());
                    Awaitility.await().atMost(Duration.ofSeconds(10)).until(()->metadata(db,"SELECT count(*) FROM pg_stat_activity WHERE usename='app_identity' AND wait_event_type='Lock'").equals("1"));
                    stopReceiver(receiver);fault.commit();
                    Awaitility.await().atMost(Duration.ofSeconds(10)).until(()->metadata(db,"SELECT count(*) FROM pg_stat_activity WHERE usename='app_identity' AND wait_event='SyncRep'").equals("1"));
                    assertThat(pending.isDone()).isFalse();
                    var response=pending.get(10,java.util.concurrent.TimeUnit.SECONDS);
                    assertThat(response.statusCode()).isEqualTo(503);var result=Json.read(response.body());
                    assertThat(result.at("/error/code").asString()).isEqualTo("temporarily_unavailable");assertThat(result.has("accessToken")).isFalse();
                }
                post(api,"auth/login",null,body,503);startReceiver(receiver);awaitFlush(db,receiver);
                assertThat(post(api,"auth/login",null,body,200).path("accessToken").asString()).isNotBlank();
            }
        }
    }

}
