package dev.ritmo;

import dev.ritmo.shared.*;
import dev.ritmo.identity.WebSessions;
import java.net.*;
import java.net.http.*;
import java.time.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.sql.*;
import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.*;
import org.springframework.beans.factory.annotation.*;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;
import static org.assertj.core.api.Assertions.*;

/** Real Postgres/HTTP; the Python contract oracle is never called. Synthetic accounts only. */
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
class WebSessionTests {
    static final PostgreSQLContainer DB=new PostgreSQLContainer("postgres@sha256:5a5a84b19854a9ffaa54082c166ff4ec27473a361e496e5ea167f298f2da9722").withStartupTimeout(Duration.ofSeconds(180));
    static final int TLS_PORT=freePort();
    static final String ORIGIN="https://127.0.0.1:"+TLS_PORT;
    static final Time CLOCK=new Time();
    static int freePort() {try(var socket=new java.net.ServerSocket(0,0,InetAddress.getLoopbackAddress())) {return socket.getLocalPort();} catch(Exception e) {throw new ExceptionInInitializerError(e);}}
    static {
        DB.start();
        try(var c=admin();var s=c.createStatement()) {
            s.execute("CREATE ROLE ritmo_domain LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD 'fixture-domain'; CREATE ROLE ritmo_identity LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD 'fixture-identity'; CREATE ROLE fixture_migration LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD 'fixture-migration'; GRANT USAGE,CREATE ON SCHEMA public TO fixture_migration;");
        } catch(SQLException e) {throw new ExceptionInInitializerError(e);}
    }
    static Connection admin() throws SQLException {return DriverManager.getConnection(DB.getJdbcUrl(),DB.getUsername(),DB.getPassword());}
    @DynamicPropertySource static void settings(DynamicPropertyRegistry p) {
        p.add("server.address",()->"127.0.0.1");p.add("ritmo.sync-retention.enabled",()->false);p.add("ritmo.web.maintenance-enabled",()->false);
        p.add("spring.datasource.url",DB::getJdbcUrl);p.add("spring.datasource.username",()->"ritmo_domain");p.add("spring.datasource.password",()->"fixture-domain");
        p.add("spring.flyway.url",DB::getJdbcUrl);p.add("spring.flyway.user",()->"fixture_migration");p.add("spring.flyway.password",()->"fixture-migration");
        p.add("ritmo.identity.url",DB::getJdbcUrl);p.add("ritmo.identity.username",()->"ritmo_identity");p.add("ritmo.identity.password",()->"fixture-identity");
        p.add("ritmo.signing-key",()->Base64.getEncoder().encodeToString(new byte[32]));p.add("ritmo.web.preparation-key",()->Base64.getEncoder().encodeToString(new byte[33]));
        p.add("ritmo.web.origin",()->ORIGIN);p.add("logging.level.root",()->"ERROR");
        for(String scope:List.of("api-ip","account","login","register","reset-request","reset-confirm","refresh","revoke")) p.add("ritmo.rate-limits."+scope+".capacity",()->1000000);
    }
    static class Time extends Clock {
        volatile Instant now=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        @Override public Instant instant() {return now;}
        @Override public ZoneId getZone() {return ZoneOffset.UTC;}
        @Override public Clock withZone(ZoneId zone) {return Clock.fixed(now,zone);}
    }
    @org.springframework.boot.test.context.TestConfiguration(proxyBeanMethods=false)
    static class TimeConfig {@org.springframework.context.annotation.Bean @org.springframework.context.annotation.Primary Clock webClock() {return CLOCK;}}
    @BeforeEach void time() {CLOCK.now=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);}
    @AfterAll static void stop() {DB.stop();}
    @LocalServerPort int port;
    @Autowired WebSessions sessions;
    @Autowired @Qualifier("identitySql") Sql identity;
    @Autowired @Qualifier("domainSql") Sql domain;
    @Autowired dev.ritmo.sync.Sync sync;
    final HttpClient http=HttpClient.newHttpClient();
    record Context(String id,String install,String tab,String close,String auth,String account,String email) {
        String path(String action) {return "/contexts/"+id+"/"+action;}
        String cookies() {return "__Secure-ritmo-close="+close+(auth==null?"":"; __Secure-ritmo-auth="+auth);}
        WebSessions.Credential credential() {return new WebSessions.Credential(id,auth,account,"1",tab);}
    }
    HttpResponse<String> call(String path,JsonNode body,String cookies,Map<String,String> extra) throws Exception {
        var builder=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/v1/web"+path))
            .timeout(Duration.ofSeconds(25)).header("Content-Type","application/json").header("Origin",ORIGIN).header("X-Ritmo-Web","1")
            .header("X-App-Version","0.1.0").header("X-Ritmo-Protocol","m1.1");
        if(cookies!=null) builder.header("Cookie",cookies);
        extra.forEach(builder::setHeader);
        var response=http.send(builder.POST(HttpRequest.BodyPublishers.ofString(body.toString())).build(),HttpResponse.BodyHandlers.ofString());
        assertThat(response.headers().firstValue("Cache-Control")).hasValue("no-store");return response;
    }
    JsonNode ok(HttpResponse<String> response,int status) {
        assertThat(response.statusCode()).as(response.body()).isEqualTo(status);
        var value=Json.read(response.body());
        assertThat(response.body()).doesNotContain("accessToken","refreshToken","revokeToken","password_hash","secret_hash");return value;
    }
    void error(HttpResponse<String> response,int status,String code) {assertThat(ok(response,status).at("/error/code").asString()).isEqualTo(code);}
    String cookie(HttpResponse<String> response,String name) {return response.headers().allValues("Set-Cookie").stream().filter(s->s.startsWith(name+"=")).findFirst().orElseThrow().split(";",2)[0].substring(name.length()+1);}
    JsonNode challenge(String install,String expected) throws Exception {
        var body=Json.object().put("attemptId",Json.id()).put("installationId",install);if(expected==null) body.putNull("expectedAccountId");else body.put("expectedAccountId",expected);
        return ok(call("/auth/challenge",body,null,Map.of()),200);
    }
    Context prepare(String install,String expected) throws Exception {
        var challenge=challenge(install,expected);String id=challenge.path("contextId").asString();
        var response=call("/auth/prepare",Json.object().put("preparationTicket",challenge.path("preparationTicket").asString()),null,Map.of());ok(response,200);
        for(String header:response.headers().allValues("Set-Cookie")) {
            assertThat(header).contains("Secure","HttpOnly","SameSite=Strict","Path=/api/v1/web/contexts/"+id+"/","Expires=").doesNotContain("Max-Age","Domain=");
        }
        var c=new Context(id,install,Json.id(),cookie(response,"__Secure-ritmo-close"),null,null,null);
        ok(call(c.path("confirm-reservation"),Json.object(),c.cookies(),Map.of()),200);return c;
    }
    Map<String,String> owner(Context c) {return Map.of("X-Ritmo-Owner-Epoch","1","X-Ritmo-Owner-Tab",c.tab());}
    Context register(String install) throws Exception {
        var c=prepare(install,null);String email=Json.id()+"@example.test";
        var response=call(c.path("register"),Json.object().put("email",email).put("password","fixture-password").put("displayName","Fixture").put("deviceId",install),c.cookies(),owner(c));
        var body=ok(response,201);sessions.validateWeb("WebSession",body);
        return new Context(c.id(),c.install(),c.tab(),c.close(),cookie(response,"__Secure-ritmo-auth"),body.path("accountId").asString(),email);
    }
    ObjectNode login(Context c,String email,String password) {return Json.object().put("email",email).put("password",password).put("deviceId",c.install());}
    @Test void reservationTicketReplayExpiredUnknownAndCloseBeforePasswordAreSafe() throws Exception {
        var c=prepare(Json.id(),null);
        error(call(c.path("login"),login(c,"none@example.test","fixture-password"),null,owner(c)),401,"session_invalid");
        ok(call(c.path("close"),Json.object(),c.cookies(),Map.of()),200);
        assertThat(ok(call(c.path("reservation-status"),Json.object(),null,Map.of()),200).path("state").asString()).isEqualTo("closed_unbound");
        var original=register(Json.id());
        error(call(c.path("login"),login(c,original.email(),"fixture-password"),c.cookies(),owner(c)),409,"context_closed");
        var body=Json.object().put("attemptId",Json.id()).put("installationId",Json.id()).putNull("expectedAccountId");
        var issued=ok(call("/auth/challenge",body,null,Map.of()),200);
        error(call("/auth/challenge",body,null,Map.of()),409,"context_conflict");
        CLOCK.now=Instant.parse(issued.path("ticketExpiresAt").asString());
        error(call("/auth/prepare",Json.object().put("preparationTicket",issued.path("preparationTicket").asString()),null,Map.of()),409,"preparation_expired");
        CLOCK.now=CLOCK.now.plusSeconds(300);
        assertThat(ok(call("/contexts/"+issued.path("contextId").asString()+"/reservation-status",Json.object(),null,Map.of()),200).path("state").asString()).isEqualTo("expired_unbound");
        error(call("/contexts/"+Json.id()+"/reservation-status",Json.object(),null,Map.of()),404,"context_unavailable");
    }
    @Test void prepareAndLoginNeverReissueSecretsAndLostBodyCanBeInspected() throws Exception {
        var issued=challenge(Json.id(),null);var request=Json.object().put("preparationTicket",issued.path("preparationTicket").asString());
        ok(call("/auth/prepare",request,null,Map.of()),200);
        var replay=call("/auth/prepare",request,null,Map.of());ok(replay,200);assertThat(replay.headers().allValues("Set-Cookie")).isEmpty();
        var c=register(Json.id());
        var inspection=call(c.path("inspect"),Json.object(),c.cookies(),owner(c));sessions.validateWeb("WebSession",ok(inspection,200));assertThat(inspection.headers().allValues("Set-Cookie")).isEmpty();
        var duplicate=call(c.path("login"),login(c,c.email(),"fixture-password"),c.cookies(),owner(c));error(duplicate,409,"context_conflict");
        error(call(c.path("register"),login(c,c.email(),"fixture-password").put("displayName","Fixture"),c.cookies(),owner(c)),409,"context_conflict");assertThat(duplicate.headers().allValues("Set-Cookie")).isEmpty();
        error(call(c.path("inspect"),Json.object(),c.cookies()+"; __Secure-ritmo-auth="+c.auth(),owner(c)),401,"cookie_ambiguous");
        error(call(c.path("inspect"),Json.object(),"__Secure-ritmo-auth="+c.close(),owner(c)),401,"session_invalid");
        var before=identity.one("select to_jsonb(last_seen_at) from identity_web_contexts where context_id=?::uuid",c.id());
        error(call(c.path("inspect"),Json.object(),c.cookies(),Map.of("X-Ritmo-Owner-Epoch","2","X-Ritmo-Owner-Tab",c.tab())),409,"owner_lost");
        assertThat(identity.one("select to_jsonb(last_seen_at) from identity_web_contexts where context_id=?::uuid",c.id())).isEqualTo(before);
    }
    @Test void csrfOriginJsonCompatibilityAuthorizationAndLargeCookieFailWithoutReserving() throws Exception {
        String install=Json.id();var body=Json.object().put("attemptId",Json.id()).put("installationId",install).putNull("expectedAccountId");
        for(var headers:List.of(Map.of("Origin","null"),Map.of("Origin","https://other.example.test"),Map.of("X-Ritmo-Web","0"),Map.of("Content-Type","text/plain"),Map.of("Content-Type","application/x-www-form-urlencoded"),Map.of("Content-Type","*/*"))) error(call("/auth/challenge",body,null,headers),403,"csrf_rejected");
        error(call("/auth/challenge",body,null,Map.of("Authorization","Bearer synthetic")),401,"session_invalid");
        error(call("/auth/challenge",body,null,Map.of("X-App-Version","0.0.0")),426,"unsupported_version");
        error(call("/auth/challenge",body,"unknown="+"x".repeat(8200),Map.of()),431,"headers_too_large");
        assertThat(identity.one("select to_jsonb(count(*)) from identity_web_contexts where installation_id=?::uuid",install).asInt()).isZero();
        // Missing Origin is distinct from an invalid Origin.
        var raw=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/v1/web/auth/challenge")).header("Content-Type","application/json").header("X-Ritmo-Web","1").header("X-App-Version","0.1.0").header("X-Ritmo-Protocol","m1.1").POST(HttpRequest.BodyPublishers.ofString(body.toString())).build();
        error(http.send(raw,HttpResponse.BodyHandlers.ofString()),403,"csrf_rejected");
    }
    @Test void concurrentChallengesCannotReserveAFifthContext() throws Exception {
        String install=Json.id();var start=new CountDownLatch(1);
        try(var executor=Executors.newVirtualThreadPerTaskExecutor()) {
            var futures=new ArrayList<Future<HttpResponse<String>>>();
            for(int i=0;i<5;i++) futures.add(executor.submit(()->{start.await();return call("/auth/challenge",Json.object().put("attemptId",Json.id()).put("installationId",install).putNull("expectedAccountId"),null,Map.of());}));
            start.countDown();int accepted=0,limited=0;
            for(var future:futures) {var response=future.get(15,TimeUnit.SECONDS);if(response.statusCode()==200) accepted++;else {error(response,409,"auth_context_limit");limited++;}}
            assertThat(accepted).isEqualTo(4);assertThat(limited).isOne();
        } finally {start.countDown();}
        assertThat(identity.one("select to_jsonb(count(*)) from identity_web_contexts where installation_id=?::uuid",install).asInt()).isEqualTo(4);
    }
    @Test void fourContextsAndOriginalPasswordRecoveryDoNotCreateAFifthSession() throws Exception {
        String install=Json.id();var a=register(install);var b=register(install);prepare(install,null);prepare(install,null);
        var fifth=Json.object().put("attemptId",Json.id()).put("installationId",install).putNull("expectedAccountId");
        error(call("/auth/challenge",fifth,null,Map.of()),409,"auth_context_limit");
        error(call(a.path("close"),Json.object(),b.cookies(),Map.of()),401,"session_invalid");
        error(call("/auth/recovery-close",Json.object().put("contextId",a.id()).put("email",b.email()).put("password","fixture-password"),b.cookies(),Map.of()),404,"context_unavailable");
        var proof=ok(call("/auth/recovery-close",Json.object().put("contextId",a.id()).put("email",a.email()).put("password","fixture-password"),null,Map.of()),200);
        assertThat(proof.path("state").asString()).isEqualTo("closed");
        assertThat(identity.one("select to_jsonb(count(*)) from identity_sessions where user_id=?::uuid",a.account()).asInt()).isZero();
        error(call(a.path("inspect"),Json.object(),a.cookies(),owner(a)),401,"session_invalid");
        ok(call(b.path("inspect"),Json.object(),b.cookies(),owner(b)),200);ok(call("/auth/challenge",fifth,null,Map.of()),200);
        assertThat(ok(call(a.path("reservation-status"),Json.object(),null,Map.of()),200).path("state").asString()).isEqualTo("proof_required");
    }
    @Test void exactIdleAbsoluteDeadlinesAndHashCleanupPreserveMinimumProof() throws Exception {
        var a=register(Json.id());Instant issued=CLOCK.now;
        CLOCK.now=issued.plus(Duration.ofDays(30)).minusNanos(1000);ok(call(a.path("inspect"),Json.object(),a.cookies(),owner(a)),200);
        var renewed=ok(call(a.path("inspect"),Json.object(),a.cookies(),owner(a)),200);
        assertThat(Instant.parse(renewed.path("idleExpiresAt").asString())).isAfter(issued.plus(Duration.ofDays(59)));
        CLOCK.now=CLOCK.now.plus(Duration.ofDays(30));error(call(a.path("inspect"),Json.object(),a.cookies(),owner(a)),401,"session_invalid");
        CLOCK.now=issued;var b=register(Json.id());
        for(int day:new int[]{29,58,87}) {CLOCK.now=issued.plus(Duration.ofDays(day));ok(call(b.path("inspect"),Json.object(),b.cookies(),owner(b)),200);}
        CLOCK.now=issued.plus(Duration.ofDays(90));error(call(b.path("inspect"),Json.object(),b.cookies(),owner(b)),401,"session_invalid");
        CLOCK.now=issued.plus(Duration.ofDays(92));assertThat(sessions.cleanup()).isPositive();
        assertThat(identity.one("select to_jsonb(c) from identity_web_contexts c where context_id=?::uuid",a.id()).path("auth_secret_hash").isNull()).isTrue();
        assertThat(identity.one("select to_jsonb(c) from identity_web_contexts c where context_id=?::uuid",a.id()).path("close_secret_hash").isNull()).isTrue();
        ok(call("/auth/recovery-close",Json.object().put("contextId",a.id()).put("email",a.email()).put("password","fixture-password"),null,Map.of()),200);
        assertThat(identity.one("select to_jsonb(count(*)) from identity_web_contexts where context_id=?::uuid",a.id()).asInt()).isOne();
    }
    @Test void databaseAuthorizationEnforcesIdleAndAbsoluteExpiryBeforeCommand() throws Exception {
        for(boolean absolute:List.of(false,true)) {
            var a=register(Json.id());
            // Set a self-consistent historical record; PostgreSQL's own clock must reject it,
            // independently of the injected Java clock used by inspect/challenge tests.
            identity.execute("""
                with at_time as (select clock_timestamp() as moment)
                update identity_web_contexts set
                ticket_issued_at=at_time.moment-(?::int*interval '24 hours')-interval '60 seconds',
                reservation_expires_at=at_time.moment-(?::int*interval '24 hours')+interval '540 seconds',
                close_expires_at=at_time.moment-(?::int*interval '24 hours')+interval '2184 hours'-interval '60 seconds',
                authenticated_at=at_time.moment-(?::int*interval '24 hours'),
                absolute_expires_at=at_time.moment-(?::int*interval '24 hours')+interval '2160 hours',
                last_seen_at=at_time.moment-(?::int*interval '24 hours')
                from at_time where context_id=?::uuid and user_id=?::uuid
                """,absolute?"90":"30",absolute?"90":"30",absolute?"90":"30",absolute?"90":"30",absolute?"90":"30",absolute?"1":"30",a.id(),a.account());
            var invoked=new java.util.concurrent.atomic.AtomicBoolean();
            assertThatThrownBy(()->sessions.authorized(a.credential(),user->{invoked.set(true);return user;})).isInstanceOf(HttpFailure.class);
            assertThat(invoked).isFalse();
        }
    }
    @Test void expectedAccountAndLateOwnerClaimsCannotAuthorizeWrongIntent() throws Exception {
        var a=register(Json.id());var b=register(Json.id());var pending=prepare(Json.id(),a.account());
        var mismatch=call(pending.path("login"),login(pending,b.email(),"fixture-password"),pending.cookies(),owner(pending));error(mismatch,409,"account_mismatch");assertThat(mismatch.headers().allValues("Set-Cookie")).isEmpty();
        String tab=Json.id();ok(call(a.path("claim-owner"),Json.object().put("epoch","3").put("tabId",tab),a.cookies(),Map.of()),200);
        error(call(a.path("claim-owner"),Json.object().put("epoch","2").put("tabId",Json.id()),a.cookies(),Map.of()),409,"owner_lost");
        error(call(a.path("claim-owner"),Json.object().put("epoch","3").put("tabId",Json.id()),a.cookies(),Map.of()),409,"owner_lost");
        error(call(a.path("sync/snapshots"),Json.object(),a.cookies(),Map.of("X-Ritmo-Owner-Epoch","3","X-Ritmo-Owner-Tab",tab,"X-Ritmo-Expected-Account",b.account())),409,"account_mismatch");
        error(call(a.path("sync/snapshots"),Json.object(),a.cookies(),Map.of("X-Ritmo-Owner-Epoch","1","X-Ritmo-Owner-Tab",a.tab(),"X-Ritmo-Expected-Account",a.account())),409,"owner_lost");
        ok(call(a.path("sync/snapshots"),Json.object(),a.cookies(),Map.of("X-Ritmo-Owner-Epoch","3","X-Ritmo-Owner-Tab",tab,"X-Ritmo-Expected-Account",a.account())),201);
    }
    JsonNode createOperation(String device) {
        Instant occurred=CLOCK.instant();
        String logicalDay=occurred.atZone(ZoneOffset.UTC).minusHours(4).toLocalDate().toString();
        return Json.object().put("operationId",Json.id()).put("deviceId",device).put("clientSequence",1).put("occurredAt",occurred.toString())
            .set("dependsOn",Json.array()).set("command",Json.object().put("type","habit.create").put("habitId",Json.id()).put("title","Caminhar")
                .put("habitType","binary").put("scheduleKind","daily").put("startDayKey",logicalDay).putNull("iconKey").putNull("colorToken").put("sortOrder",0)
                .set("timeContext",Json.object().put("timezone","UTC").put("dayStartHour",4)));
    }
    @Test void authorizationLocksAndDomainCommitUseSameTransactionWithRlsAndNoPrivateGrants() throws Exception {
        var a=register(Json.id());var b=register(Json.id());var operation=createOperation(a.install());var batch=Json.object().set("operations",Json.array().add(operation));
        var inCommand=new CountDownLatch(1);var finish=new CountDownLatch(1);
        try(var executor=Executors.newVirtualThreadPerTaskExecutor()) {
            var writer=executor.submit(()->sessions.authorized(a.credential(),user->{
                var before=domain.one("select jsonb_build_object('pid',pg_backend_pid(),'tx',txid_current(),'user',current_setting('app.user_id'))");
                inCommand.countDown();try {if(!finish.await(10,TimeUnit.SECONDS)) throw new IllegalStateException("test deadline");} catch(InterruptedException e) {throw new IllegalStateException(e);}
                var result=sync.push(user,Json.id(),batch);
                assertThat(domain.one("select jsonb_build_object('pid',pg_backend_pid(),'tx',txid_current(),'user',current_setting('app.user_id'))")).isEqualTo(before);
                assertThat(domain.one("select to_jsonb(count(*)) from habits where user_id=?::uuid",b.account()).asInt()).isZero();
                assertThat(domain.one("select to_jsonb(count(*)) from habits").asInt()).isOne(); // Deliberate missing-filter probe verifies RLS.
                return result;
            }));
            assertThat(inCommand.await(10,TimeUnit.SECONDS)).isTrue();
            var claim=executor.submit(()->call(a.path("claim-owner"),Json.object().put("epoch","2").put("tabId",Json.id()),a.cookies(),Map.of()));
            Thread.sleep(150);assertThat(claim.isDone()).isFalse();finish.countDown();
            assertThat(writer.get(10,TimeUnit.SECONDS).at("/results/0/receipt/status").asString()).isEqualTo("accepted");ok(claim.get(10,TimeUnit.SECONDS),200);
        } finally {finish.countDown();}
        assertThatThrownBy(()->sessions.authorized(a.credential(),user->sync.push(user,Json.id(),batch))).isInstanceOf(HttpFailure.class);
        try(var c=DriverManager.getConnection(DB.getJdbcUrl(),"ritmo_domain","fixture-domain");var s=c.createStatement()) {
            assertThatThrownBy(()->s.execute("select auth_secret_hash from identity_web_contexts")).isInstanceOf(SQLException.class).hasMessageContaining("permission denied");
            assertThatThrownBy(()->s.execute("select password_hash from users")).isInstanceOf(SQLException.class).hasMessageContaining("permission denied");
        }
    }
    @Test void nativeOnboardingAndWebCommandsCannotInvertTheAccountLockOrder() throws Exception {
        var a=register(Json.id());
        var ready=new CountDownLatch(1);var release=new CountDownLatch(1);
        var operation=Json.object().put("operationId",Json.id()).put("deviceId",a.install()).put("clientSequence",1).put("occurredAt",Instant.now().toString())
            .set("dependsOn",Json.array()).set("command",Json.object().put("type","profile.setOnboarding").put("completed",true).put("analyticsConsent",false)
                .set("timeContext",Json.object().put("timezone","UTC").put("dayStartHour",4)));
        try(var executor=Executors.newVirtualThreadPerTaskExecutor()) {
            var web=executor.submit(()->sessions.authorized(a.credential(),user->{
                ready.countDown();try {if(!release.await(15,TimeUnit.SECONDS)) throw new IllegalStateException("fixture deadline");} catch(InterruptedException e) {throw new IllegalStateException(e);}
                return sync.snapshot(user);
            }));
            assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();
            var nativeCommand=executor.submit(()->sync.push(a.account(),Json.id(),Json.object().set("operations",Json.array().add(operation))));
            try {
                long deadline=System.nanoTime()+Duration.ofSeconds(10).toNanos();boolean blocked=false;
                while(System.nanoTime()<deadline) {
                    try(var c=admin();var statement=c.createStatement();var rows=statement.executeQuery("select count(*) from pg_stat_activity where usename='ritmo_domain' and wait_event_type='Lock'")) {rows.next();blocked=rows.getInt(1)>0;}
                    if(blocked) break;Thread.sleep(20);
                }
                assertThat(blocked).isTrue();
            } finally {release.countDown();}
            assertThat(web.get(10,TimeUnit.SECONDS).has("snapshotId")).isTrue();
            assertThat(nativeCommand.get(10,TimeUnit.SECONDS).at("/results/0/receipt/status").asString()).isEqualTo("accepted");
        } finally {release.countDown();}
    }
    @Test void pushRollbackAndAccountIsolationKeepNativeReceiptsUnchanged() throws Exception {
        var a=register(Json.id());var b=register(Json.id());var operation=createOperation(a.install());var body=Json.object().set("operations",Json.array().add(operation));
        var headers=new HashMap<>(owner(a));headers.put("X-Ritmo-Expected-Account",a.account());
        error(call(a.path("sync/push"),body,a.cookies(),headers),400,"invalid_request");
        headers.put("Idempotency-Key",Json.id());
        var response=ok(call(a.path("sync/push"),body,a.cookies(),headers),200);assertThat(response.at("/results/0/receipt/status").asString()).isEqualTo("accepted");
        assertThat(ok(call(a.path("sync/push"),body,a.cookies(),headers),200).at("/results/0/replayed").asBoolean()).isTrue();
        headers.put("X-Ritmo-Expected-Account",b.account());error(call(a.path("sync/push"),body,a.cookies(),headers),409,"account_mismatch");
        var rollback=createOperation(b.install());
        assertThatThrownBy(()->sessions.authorized(b.credential(),user->{sync.push(user,Json.id(),Json.object().set("operations",Json.array().add(rollback)));throw new IllegalStateException("fixture rollback");})).isInstanceOf(IllegalStateException.class);
        assertThat(identity.one("select to_jsonb(count(*)) from users where id=?::uuid",b.account()).asInt()).isOne();
        var clean=sessions.authorized(b.credential(),user->domain.one("select to_jsonb(count(*)) from sync_operation_receipts where user_id=?::uuid",user));assertThat(clean.asInt()).isZero();
    }
    @Test void webSyncAdaptersPreserveSnapshotPullAndReceiptIsolation() throws Exception {
        var a=register(Json.id());var b=register(Json.id());
        var headers=new HashMap<>(owner(a));headers.put("X-Ritmo-Expected-Account",a.account());
        var manifest=ok(call(a.path("sync/snapshots"),Json.object(),a.cookies(),headers),201);
        var page=ok(call(a.path("sync/snapshots/"+manifest.path("snapshotId").asString()),Json.object().put("pageCursor",manifest.path("firstPageCursor").asString()),a.cookies(),headers),200);
        sessions.validateWeb("SnapshotPage",page);
        var operation=createOperation(a.install());headers.put("Idempotency-Key",Json.id());
        ok(call(a.path("sync/push"),Json.object().set("operations",Json.array().add(operation)),a.cookies(),headers),200);
        var pulled=ok(call(a.path("sync/pull"),Json.object().put("cursor",page.path("pullCursor").asString()).put("limit",1),a.cookies(),headers),200);
        sessions.validateWeb("PullResponse",pulled);assertThat(pulled.path("changes").size()).isOne();
        var receipt=ok(call(a.path("sync/receipts"),Json.object().put("snapshotId",manifest.path("snapshotId").asString()).set("operationIds",Json.array().add(operation.path("operationId").asString())),a.cookies(),headers),200);
        sessions.validateWeb("ReceiptsResponse",receipt);assertThat(receipt.at("/results/0/status").asString()).isEqualTo("notProcessedAtH");
        var bHeaders=new HashMap<>(owner(b));bHeaders.put("X-Ritmo-Expected-Account",b.account());
        error(call(b.path("sync/snapshots/"+manifest.path("snapshotId").asString()),Json.object().put("pageCursor",manifest.path("firstPageCursor").asString()),b.cookies(),bHeaders),404,"resource_inaccessible");
    }
    String resetToken(Context c) {
        byte[] secret=new byte[32];new java.security.SecureRandom().nextBytes(secret);String token=Base64.getUrlEncoder().withoutPadding().encodeToString(secret);
        identity.execute("insert into identity_password_resets(user_id,id,token_hash,expires_at) values(?::uuid,?::uuid,decode(?,'hex'),?::timestamptz)",c.account(),Json.id(),Json.digest(token),CLOCK.now.plusSeconds(3600).toString());return token;
    }
    @Test void resetBeforeLoginRejectsOldPasswordAndLoginBeforeResetRevokesTheIssuedContext() throws Exception {
        var a=register(Json.id());var pending=prepare(Json.id(),a.account());String reset=resetToken(a);
        ok(call("/auth/password-reset/confirm",Json.object().put("resetToken",reset).put("newPassword","changed-password"),null,Map.of()),200);
        error(call(pending.path("login"),login(pending,a.email(),"fixture-password"),pending.cookies(),owner(pending)),401,"invalid_credentials");
        var logged=call(pending.path("login"),login(pending,a.email(),"changed-password"),pending.cookies(),owner(pending));ok(logged,200);
        String auth=cookie(logged,"__Secure-ritmo-auth");
        reset=resetToken(a);ok(call("/auth/password-reset/confirm",Json.object().put("resetToken",reset).put("newPassword","another-password"),null,Map.of()),200);
        error(call(pending.path("inspect"),Json.object(),"__Secure-ritmo-auth="+auth,owner(pending)),401,"session_invalid");
        error(call(a.path("inspect"),Json.object(),a.cookies(),owner(a)),401,"session_invalid");
    }
    void awaitIdentityLock() throws Exception {
        long deadline=System.nanoTime()+Duration.ofSeconds(10).toNanos();
        while(System.nanoTime()<deadline) {
            try(var c=admin();var statement=c.createStatement();var rows=statement.executeQuery("select count(*) from pg_stat_activity where usename='ritmo_identity' and wait_event_type='Lock' and query like '%identity_web_contexts%'")) {
                rows.next();if(rows.getInt(1)>0) return;
            }
            Thread.sleep(20);
        }
        throw new AssertionError("Identity did not reach the real context lock");
    }
    @Test void passwordResetAndLoginSerializeInBothOverlappingOrders() throws Exception {
        for(boolean resetFirst:List.of(false,true)) {
            var a=register(Json.id());var pending=prepare(Json.id(),a.account());String token=resetToken(a);
            try(var gate=admin();var statement=gate.createStatement();var executor=Executors.newVirtualThreadPerTaskExecutor()) {
                gate.setAutoCommit(false);
                // Hold the context which the chosen first request reaches only after locking the user.
                statement.executeQuery("select context_id from identity_web_contexts where context_id='"+(resetFirst?a.id():pending.id())+"' for update").close();
                Callable<HttpResponse<String>> reset=()->call("/auth/password-reset/confirm",Json.object().put("resetToken",token).put("newPassword","changed-password"),null,Map.of());
                Callable<HttpResponse<String>> login=()->call(pending.path("login"),login(pending,a.email(),"fixture-password"),pending.cookies(),owner(pending));
                var first=executor.submit(resetFirst?reset:login);Future<HttpResponse<String>> second;
                try {awaitIdentityLock();second=executor.submit(resetFirst?login:reset);}
                finally {gate.commit();}
                var one=first.get(15,TimeUnit.SECONDS);var two=second.get(15,TimeUnit.SECONDS);
                if(resetFirst) {ok(one,200);error(two,401,"invalid_credentials");}
                else {ok(one,200);ok(two,200);error(call(pending.path("inspect"),Json.object(),"__Secure-ritmo-auth="+cookie(one,"__Secure-ritmo-auth"),owner(pending)),401,"session_invalid");}
            }
        }
    }
    @Test void restorePreparationAlsoInvalidatesWebAndQuarantineRejectsAllWebRoutes() throws Exception {
        var a=register(Json.id());
        try(var connection=admin();var statement=connection.createStatement()) {
            connection.setAutoCommit(false);statement.execute(Files.readString(Path.of("ops/prepare-recovery.sql")));connection.commit();
        }
        error(call(a.path("inspect"),Json.object(),a.cookies(),owner(a)),401,"session_invalid");
        var expired=prepare(Json.id(),null);
        identity.execute("""
            with at_time as (select clock_timestamp() as moment)
            update identity_web_contexts set ticket_issued_at=at_time.moment-interval '660 seconds',
            reservation_expires_at=at_time.moment-interval '60 seconds',
            close_expires_at=at_time.moment+interval '2184 hours'-interval '660 seconds'
            from at_time where context_id=?::uuid and user_id is null
            """,expired.id());
        var options=Map.ofEntries(
            Map.entry("server.port","0"),Map.entry("server.address","127.0.0.1"),Map.entry("logging.level.root","ERROR"),
            Map.entry("spring.datasource.url",DB.getJdbcUrl()),Map.entry("spring.datasource.username","ritmo_domain"),Map.entry("spring.datasource.password","fixture-domain"),
            Map.entry("spring.flyway.url",DB.getJdbcUrl()),Map.entry("spring.flyway.user","fixture_migration"),Map.entry("spring.flyway.password","fixture-migration"),
            Map.entry("ritmo.identity.url",DB.getJdbcUrl()),Map.entry("ritmo.identity.username","ritmo_identity"),Map.entry("ritmo.identity.password","fixture-identity"),
            Map.entry("ritmo.signing-key",Base64.getEncoder().encodeToString(new byte[32])),Map.entry("ritmo.web.preparation-key",Base64.getEncoder().encodeToString(new byte[33])),
            Map.entry("ritmo.web.origin",ORIGIN),Map.entry("ritmo.operations.quarantined","true"),Map.entry("ritmo.sync-retention.enabled","false"),Map.entry("ritmo.web.maintenance-enabled","true"),Map.entry("ritmo.web.cleanup-ms","25"));
        try(var quarantined=new org.springframework.boot.builder.SpringApplicationBuilder(RitmoApplication.class).run(options.entrySet().stream().map(e->"--"+e.getKey()+"="+e.getValue()).toArray(String[]::new))) {
            int quarantinePort=quarantined.getEnvironment().getRequiredProperty("local.server.port",Integer.class);
            assertThat(quarantined.containsBean("webMaintenance")).isTrue();
            Thread.sleep(150);
            assertThat(identity.one("select to_jsonb(state) from identity_web_contexts where context_id=?::uuid and user_id is null",expired.id()).asString()).isEqualTo("reserved");
            for(String route:List.of("/auth/challenge",a.path("inspect"),a.path("sync/push"),"/auth/password-reset/confirm")) {
                var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+quarantinePort+"/api/v1/web"+route)).POST(HttpRequest.BodyPublishers.ofString("{}")).build();
                var response=http.send(request,HttpResponse.BodyHandlers.ofString());error(response,503,"temporarily_unavailable");assertThat(response.headers().firstValue("Cache-Control")).hasValue("no-store");
            }
        }
    }
    @Test @Timeout(180) void visibleHttpsBrowserProvesActualCookiePathsAndLateResponses() throws Exception {
        org.junit.jupiter.api.Assumptions.assumeTrue("1".equals(System.getenv("RITMO_WEB_BROWSER")),"Visible browser opt-in: RITMO_WEB_BROWSER=1");
        visibleBrowser("verify-web-session.mjs","web-session");
    }
    @Test @Timeout(240) void visibleBrowserProvesIndexedDbOwnershipAndCommits() throws Exception {
        org.junit.jupiter.api.Assumptions.assumeTrue("1".equals(System.getenv("RITMO_WEB_COORDINATION")),"Visible browser opt-in: RITMO_WEB_COORDINATION=1");
        visibleBrowser("verify-coordination.mjs","web-coordination");
    }
    void visibleBrowser(String script,String folder) throws Exception {
        Path output=Path.of("../output/playwright/"+folder).toAbsolutePath().normalize();Files.createDirectories(output);
        Path cert=Files.createTempDirectory(Path.of("build").toAbsolutePath(),"web-cert-");
        try {
            String keytool=Path.of(System.getProperty("java.home"),"bin",System.getProperty("os.name").toLowerCase().contains("windows")?"keytool.exe":"keytool").toString();
            var process=new ProcessBuilder(keytool,"-genkeypair","-alias","fixture","-keyalg","RSA","-keysize","2048","-dname","CN=127.0.0.1","-ext","SAN=ip:127.0.0.1","-validity","2","-storetype","PKCS12","-keystore",cert.resolve("fixture.p12").toString(),"-storepass","fixture-password")
                .redirectErrorStream(true).redirectOutput(cert.resolve("keytool.log").toFile()).start();
            try {assertThat(process.waitFor(30,TimeUnit.SECONDS)).isTrue();assertThat(process.exitValue()).isZero();} finally {if(process.isAlive()) process.destroyForcibly();}
            var driver=new ProcessBuilder("node","--import","tsx","scripts/"+script,Integer.toString(port),Integer.toString(TLS_PORT),cert.resolve("fixture.p12").toString(),output.toString())
                .directory(Path.of("../web").toFile()).redirectErrorStream(true).redirectOutput(output.resolve("driver.log").toFile()).start();
            try {assertThat(driver.waitFor(script.equals("verify-coordination.mjs")?210:120,TimeUnit.SECONDS)).as("Visible browser deadline").isTrue();assertThat(driver.exitValue()).as(Files.readString(output.resolve("driver.log"))).isZero();}
            finally {if(driver.isAlive()) {driver.descendants().forEach(ProcessHandle::destroyForcibly);driver.destroyForcibly();driver.waitFor(5,TimeUnit.SECONDS);}}
        } finally {
            assertThat(cert.startsWith(Path.of("build").toAbsolutePath().normalize())).isTrue();
            for(String name:List.of("fixture.p12","keytool.log")) Files.deleteIfExists(cert.resolve(name));Files.deleteIfExists(cert);
        }
    }
}
