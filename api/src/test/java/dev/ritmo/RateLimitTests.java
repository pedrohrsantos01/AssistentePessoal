package dev.ritmo;

import java.net.URI;
import java.net.http.*;
import dev.ritmo.shared.Json;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties="ritmo.rate-limits.max-buckets=8")
class RateLimitTests {
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
    @org.junit.jupiter.api.AfterAll static void stop() {MAIL.stop();POSTGRES.stop();}
    static final TestMeter TIME=new TestMeter();
    static class TestMeter implements io.github.bucket4j.TimeMeter {
        private final java.util.concurrent.atomic.AtomicLong nanos=new java.util.concurrent.atomic.AtomicLong(1000000000L);
        void advance(long ns) {nanos.addAndGet(ns);}
        @Override public long currentTimeNanos() {return nanos.get();}
        @Override public boolean isWallClockBased() {return false;}
    }
    @org.springframework.boot.test.context.TestConfiguration(proxyBeanMethods=false)
    static class TestTime {
        @org.springframework.context.annotation.Bean @org.springframework.context.annotation.Primary
        io.github.bucket4j.TimeMeter meter() {return TIME;}
    }
    @org.junit.jupiter.api.BeforeEach void refill() {TIME.advance(java.time.Duration.ofDays(1).toNanos());}
    @LocalServerPort int port;
    private final HttpClient client=HttpClient.newHttpClient();
    private HttpResponse<String> request(String path,String token,String body,String forwarded) throws Exception {
        var builder=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+(path.startsWith("/")?path:"/api/v1/"+path)))
            .header("X-Ritmo-Protocol","m1.1").header("X-App-Version","0.1.0").header("Content-Type","application/json").header("Idempotency-Key",Json.id());
        if(token!=null) builder.header("Authorization","Bearer "+token);
        if(forwarded!=null) builder.header("X-Forwarded-For",forwarded).header("Forwarded","for="+forwarded);
        return client.send(body==null?builder.GET().build():builder.POST(HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString());
    }
    private String login(String email) {
        return "{\"email\":\""+email+"\",\"password\":\"fixture-password\",\"deviceId\":\""+Json.id()+"\"}";
    }
    @Test void loginBudgetCannotBeResetByChangingEmailDeviceOrForwardedIp() throws Exception {
        for(int i=0;i<10;i++) assertThat(request("auth/login",null,login("unknown"+i+"@example.test"),"192.0.2."+i).statusCode()).isEqualTo(401);
        var blocked=request("auth/login",null,login("another@example.test"),"198.51.100.1");
        assertThat(blocked.statusCode()).isEqualTo(429);
        assertThat(blocked.headers().firstValue("Retry-After")).hasValue("6");
        assertThat(Json.read(blocked.body()).at("/error/code").asString()).isEqualTo("rate_limited");
        assertThat(Json.read(blocked.body()).at("/error/retryAfterSeconds").asInt()).isEqualTo(6);
    }
    private tools.jackson.databind.JsonNode register(String email) throws Exception {
        var body=Json.object().put("email",email).put("password","fixture-password").put("displayName","Pessoa").put("deviceId",Json.id());
        var response=request("auth/register",null,body.toString(),null);
        assertThat(response.statusCode()).isEqualTo(201);return Json.read(response.body());
    }
    @Test void accountQuotaIsSharedByRoutesAndDevicesButIsolatedFromAnotherAccount() throws Exception {
        String email=Json.id()+"@example.test";var account=register(email);var other=register(Json.id()+"@example.test");String token=account.path("accessToken").asString();
        var device=request("auth/login",null,login(email),null);
        assertThat(device.statusCode()).isEqualTo(200);
        String secondToken=Json.read(device.body()).path("accessToken").asString();
        for(int i=0;i<120;i++) {
            var response=i%2==0?request("sync/pull",token,null,null):request("sync/receipts",secondToken,"{}",null);
            assertThat(response.statusCode()).isEqualTo(i%2==0?409:400);
        }
        assertThat(request("sync/snapshots",token,"{}",null).statusCode()).isEqualTo(429);
        assertThat(request("sync/pull",other.path("accessToken").asString(),null,null).statusCode()).isEqualTo(409);
        assertThat(request("sync/pull","invalid-token",null,null).statusCode()).isEqualTo(401);
        TIME.advance(499999999L);
        assertThat(request("sync/pull",token,null,null).statusCode()).isEqualTo(429);
        TIME.advance(1);
        assertThat(request("sync/pull",token,null,null).statusCode()).isEqualTo(409);
    }

    private void quota(String path,String body,int count,int allowed,String retry) throws Exception {
        for(int i=0;i<count;i++) assertThat(request(path,null,body,null).statusCode()).as(path).isEqualTo(allowed);
        var response=request(path,null,body,null);
        assertThat(response.statusCode()).as(path).isEqualTo(429);
        assertThat(response.headers().firstValue("Retry-After")).hasValue(retry);
    }
    @Test void anonymousEndpointsHaveIndependentApprovedQuotas() throws Exception {
        quota("auth/register","{}",5,400,"12");
        quota("auth/password-reset/request","{\"email\":\"unknown@example.test\"}",3,202,"300");
        quota("auth/password-reset/confirm","{}",10,400,"6");
        quota("auth/refresh","{}",60,400,"1");
        quota("auth/revoke","{}",60,400,"1");
        quota("auth/login","{}",10,400,"6");
    }

    @Test void encodedRoutesCannotBypassEndpointOrApiQuotas() throws Exception {
        for(int i=0;i<10;i++) assertThat(request("auth/login",null,login("unknown@example.test"),null).statusCode()).isEqualTo(401);
        assertThat(request("auth/%6cogin",null,login("unknown@example.test"),null).statusCode()).isEqualTo(429);
        assertThat(request("/api/%76%31/auth/login",null,login("unknown@example.test"),null).statusCode()).isEqualTo(429);
    }

    @Test void apiIpBudgetProtectsEvenInvalidProtocolRequests() throws Exception {
        for(int i=0;i<300;i++) {
            var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/%76%31/sync/pull"))
                .header("X-Forwarded-For","192.0.2."+(i%200)).GET().build();
            assertThat(client.send(request,HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(426);
        }
        var blocked=request("sync/pull",null,null,null);
        assertThat(blocked.statusCode()).isEqualTo(429);
        assertThat(blocked.headers().firstValue("Retry-After")).hasValue("1");
    }
    @Test void concurrentLoginRequestsCannotOverdrawAndRefillRoundsUp() throws Exception {
        var pending=new java.util.ArrayList<java.util.concurrent.CompletableFuture<HttpResponse<String>>>();
        for(int i=0;i<20;i++) {
            var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/v1/auth/login"))
                .header("X-Ritmo-Protocol","m1.1").header("X-App-Version","0.1.0").header("Content-Type","application/json")
                .POST(HttpRequest.BodyPublishers.ofString(login("parallel@example.test"))).build();
            pending.add(client.sendAsync(request,HttpResponse.BodyHandlers.ofString()));
        }
        var statuses=pending.stream().map(p->p.join().statusCode()).toList();
        assertThat(statuses.stream().filter(s->s==401).count()).isEqualTo(10);
        assertThat(statuses.stream().filter(s->s==429).count()).isEqualTo(10);
        TIME.advance(5999999999L);
        var blocked=request("auth/login",null,login("parallel@example.test"),null);
        assertThat(blocked.statusCode()).isEqualTo(429);
        assertThat(blocked.headers().firstValue("Retry-After")).hasValue("1");
        TIME.advance(1);
        assertThat(request("auth/login",null,login("parallel@example.test"),null).statusCode()).isEqualTo(401);
    }
    @Test void memoryPressureRejectsNewAccountsWithoutEvictingExistingDebt() throws Exception {
        var tokens=new java.util.ArrayList<String>();
        for(int i=0;i<7;i++) {TIME.advance(900000000000L);tokens.add(register(Json.id()+"@example.test").path("accessToken").asString());}
        for(int i=0;i<120;i++) assertThat(request("sync/pull",tokens.getFirst(),null,null).statusCode()).isEqualTo(409);
        String denied=null;
        for(int i=1;i<tokens.size();i++) {
            var response=request("sync/pull",tokens.get(i),null,null);
            assertThat(response.statusCode()).isIn(409,503);
            if(response.statusCode()==503) {
                denied=tokens.get(i);
                assertThat(response.headers().firstValue("Retry-After")).isPresent();
                assertThat(Json.read(response.body()).at("/error/code").asString()).isEqualTo("temporarily_unavailable");
            }
        }
        assertThat(denied).isNotNull();
        assertThat(request("sync/pull",tokens.getFirst(),null,null).statusCode()).isEqualTo(429);
        TIME.advance(60000000000L);
        assertThat(request("sync/pull",denied,null,null).statusCode()).isEqualTo(409);
    }
    @Test void passwordRecoveryQuotaDoesNotRevealWhetherTheEmailExists() throws Exception {
        String email=Json.id()+"@example.test";register(email);
        for(String target:java.util.List.of(email,"unknown@example.test",email)) {
            var response=request("auth/password-reset/request",null,Json.object().put("email",target).toString(),null);
            assertThat(response.statusCode()).isEqualTo(202);
        }
        var known=request("auth/password-reset/request",null,Json.object().put("email",email).toString(),null);
        var unknown=request("auth/password-reset/request",null,"{\"email\":\"other@example.test\"}",null);
        assertThat(known.statusCode()).isEqualTo(429);assertThat(unknown.statusCode()).isEqualTo(429);
        assertThat(known.headers().firstValue("Retry-After")).hasValue("300");
        assertThat(Json.read(known.body()).at("/error/code")).isEqualTo(Json.read(unknown.body()).at("/error/code"));
    }
    @Test void rejectedRefreshAndRevokeDoNotConsumeOrRevokeCredentials() throws Exception {
        var session=register(Json.id()+"@example.test");
        String unknown="x".repeat(43);
        quota("auth/refresh",Json.object().put("refreshToken",unknown).toString(),60,401,"1");
        assertThat(request("auth/refresh",null,Json.object().put("refreshToken",session.path("refreshToken").asString()).toString(),null).statusCode()).isEqualTo(429);
        quota("auth/revoke",Json.object().put("revokeToken",unknown).toString(),60,204,"1");
        assertThat(request("auth/revoke",null,Json.object().put("revokeToken",session.path("revokeToken").asString()).toString(),null).statusCode()).isEqualTo(429);
        TIME.advance(1000000000L);
        var renewed=request("auth/refresh",null,Json.object().put("refreshToken",session.path("refreshToken").asString()).toString(),null);
        assertThat(renewed.statusCode()).isEqualTo(200);
        assertThat(request("auth/revoke",null,Json.object().put("revokeToken",session.path("revokeToken").asString()).toString(),null).statusCode()).isEqualTo(204);
        TIME.advance(1000000000L);
        assertThat(request("auth/refresh",null,Json.object().put("refreshToken",Json.read(renewed.body()).path("refreshToken").asString()).toString(),null).statusCode()).isEqualTo(401);
    }
    @Test void aFiftyOperationPushConsumesOnlyOneRequestToken() throws Exception {
        String token=register(Json.id()+"@example.test").path("accessToken").asString();
        for(int i=0;i<118;i++) assertThat(request("sync/pull",token,null,null).statusCode()).isEqualTo(409);
        var operations=Json.array();
        for(int i=0;i<50;i++) {
            var command=Json.object().put("type","habit.create").put("habitId",Json.id()).put("title","Batch habit "+i)
                .put("habitType","binary").put("scheduleKind","daily").put("startDayKey","2026-09-25").put("sortOrder",i);
            command.set("timeContext",Json.object().put("timezone","UTC").put("dayStartHour",4));
            command.putNull("iconKey");command.putNull("colorToken");
            var operation=Json.object().put("operationId",Json.id()).put("deviceId","01996300-0000-7000-8000-000000000002")
                .put("clientSequence",i+1).put("occurredAt","2026-09-25T13:00:00Z");
            operation.set("dependsOn",Json.array());operation.set("command",command);operations.add(operation);
        }
        var body=Json.object();body.set("operations",operations);
        var response=request("sync/push",token,body.toString(),null);
        assertThat(response.statusCode()).isEqualTo(200);
        var results=Json.read(response.body()).path("results");assertThat(results.size()).isEqualTo(50);
        for(var result:results) assertThat(result.at("/receipt/status").asString()).isEqualTo("accepted");
        assertThat(request("sync/pull",token,null,null).statusCode()).isEqualTo(409);
        assertThat(request("sync/pull",token,null,null).statusCode()).isEqualTo(429);
    }
    @Test void mobileSQLiteIntentionsSurviveARealHttpRateLimitAndReopen() throws Exception {
        var directory=java.nio.file.Files.createTempDirectory("ritmo-rate-clock-");
        var ready=directory.resolve("ready");var release=directory.resolve("release");
        var log=java.nio.file.Path.of("build/rate-limit-integration.log");
        var builder=new ProcessBuilder("node","--import","tsx","--test","test/integration/rate-limits.test.ts")
            .directory(java.nio.file.Path.of("../app").toFile()).redirectErrorStream(true).redirectOutput(log.toFile());
        builder.environment().put("RITMO_TEST_API","http://127.0.0.1:"+port);
        builder.environment().put("RITMO_TEST_RATE_READY",ready.toString());builder.environment().put("RITMO_TEST_RATE_RELEASE",release.toString());
        var process=builder.start();
        try {
            // This wait includes Node/tsx startup plus 119 real HTTP requests, not the rate-limit clock.
            // Match the bounded integration preparation window under host paging; quota assertions stay intact.
            long deadline=System.nanoTime()+java.time.Duration.ofSeconds(120).toNanos();
            while(process.isAlive()&&!java.nio.file.Files.exists(ready)&&System.nanoTime()<deadline) Thread.sleep(10);
            assertThat(java.nio.file.Files.exists(ready)).as(java.nio.file.Files.readString(log)).isTrue();
            TIME.advance(60000000000L);java.nio.file.Files.writeString(release,"refilled");
            assertThat(process.waitFor(60,java.util.concurrent.TimeUnit.SECONDS)).as(java.nio.file.Files.readString(log)).isTrue();
            assertThat(process.exitValue()).as(java.nio.file.Files.readString(log)).isZero();
            System.out.println(java.nio.file.Files.readString(log));
        } finally {
            if(process.isAlive()) process.destroyForcibly().waitFor();
            java.nio.file.Files.deleteIfExists(ready);java.nio.file.Files.deleteIfExists(release);java.nio.file.Files.delete(directory);
        }
    }

}
