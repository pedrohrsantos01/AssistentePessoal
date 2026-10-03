package dev.ritmo;

import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
    "ritmo.proxy.trusted-peers=127.0.0.1", "ritmo.rate-limits.login.capacity=2",
    "ritmo.rate-limits.login.period-seconds=86400"})
class TrustedProxyTests {
    static final PostgreSQLContainer DB=new PostgreSQLContainer("postgres@sha256:5a5a84b19854a9ffaa54082c166ff4ec27473a361e496e5ea167f298f2da9722");
    static {
        DB.start();
        try(var c=java.sql.DriverManager.getConnection(DB.getJdbcUrl(),DB.getUsername(),DB.getPassword());var s=c.createStatement()) {
            s.execute("CREATE ROLE ritmo_domain LOGIN PASSWORD 'fixture-domain'; CREATE ROLE ritmo_identity LOGIN PASSWORD 'fixture-identity';");
        } catch(java.sql.SQLException e) {throw new ExceptionInInitializerError(e);}
    }
    @DynamicPropertySource static void configuration(DynamicPropertyRegistry p) {
        p.add("server.address",()->"127.0.0.1");p.add("spring.datasource.url",DB::getJdbcUrl);
        p.add("spring.datasource.username",()->"ritmo_domain");p.add("spring.datasource.password",()->"fixture-domain");
        p.add("spring.flyway.url",DB::getJdbcUrl);p.add("spring.flyway.user",DB::getUsername);p.add("spring.flyway.password",DB::getPassword);
        p.add("ritmo.identity.url",DB::getJdbcUrl);p.add("ritmo.identity.username",()->"ritmo_identity");p.add("ritmo.identity.password",()->"fixture-identity");
        p.add("ritmo.signing-key",()->java.util.Base64.getEncoder().encodeToString(new byte[32]));
        p.add("ritmo.recovery.origin",()->"https://api.example.test");p.add("ritmo.recovery.from",()->"no-reply@example.test");
    }
    @org.junit.jupiter.api.AfterAll static void stop() {DB.stop();}
    @LocalServerPort int port;
    private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private HttpResponse<String> login(String... ips) throws Exception {
        var b=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/v1/auth/login"))
            .timeout(Duration.ofSeconds(10)).header("X-Ritmo-Protocol","m1.1").header("X-App-Version","0.1.0")
            .header("Content-Type","application/json");
        for(var ip:ips) b.header("X-Forwarded-For",ip);
        return client.send(b.POST(HttpRequest.BodyPublishers.ofString("{\"email\":\"unknown@example.test\",\"password\":\"fixture-password\",\"deviceId\":\"018fbe80-1234-7000-8000-000000000001\"}")).build(),HttpResponse.BodyHandlers.ofString());
    }
    @Test void trustedProxyKeepsIndependentClientBudgets() throws Exception {
        assertThat(login("192.0.2.10").statusCode()).isEqualTo(401);
        assertThat(login("192.0.2.10").statusCode()).isEqualTo(401);
        var blocked=login("192.0.2.10");
        assertThat(blocked.statusCode()).isEqualTo(429);
        assertThat(blocked.headers().firstValue("Retry-After")).isPresent();
        assertThat(login("192.0.2.11").statusCode()).isEqualTo(401);
    }
    @Test void equivalentIpv6AndMappedIpv4ShareBudgets() throws Exception {
        assertThat(login("2001:db8::a").statusCode()).isEqualTo(401);
        assertThat(login("2001:0DB8:0000:0000:0000:0000:0000:000A").statusCode()).isEqualTo(401);
        assertThat(login("2001:db8::a").statusCode()).isEqualTo(429);
        assertThat(login("192.0.2.20").statusCode()).isEqualTo(401);
        assertThat(login("::ffff:192.0.2.20").statusCode()).isEqualTo(401);
        assertThat(login("::ffff:c000:214").statusCode()).isEqualTo(429);
    }
    @Test void ambiguousOrInvalidHeadersFallBackToTheSameSocketPeer() throws Exception {
        assertThat(login().statusCode()).isEqualTo(401);
        assertThat(login("192.0.2.30","192.0.2.31").statusCode()).isEqualTo(401);
        for(var header:java.util.List.of("192.0.2.32, 192.0.2.33","example.test","192.0.2.34:80",
                "999.1.2.3","[2001:db8::1]","fe80::1%eth0","01.2.3.4","::ffff:invalid","a".repeat(46))) {
            var response=login(header);
            assertThat(response.statusCode()).as(header).isEqualTo(429);
            assertThat(response.headers().firstValue("Retry-After")).isPresent();
        }
    }
}
