package dev.ritmo;

import dev.ritmo.shared.Json;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.Network;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.MountableFile;
import tools.jackson.databind.JsonNode;
import static org.assertj.core.api.Assertions.assertThat;

/** Exercises the actual deployable JAR, not the test classpath. No external service is retained. */
class ContainerPackagingTests {
    private static final String POSTGRES="postgres@sha256:5a5a84b19854a9ffaa54082c166ff4ec27473a361e496e5ea167f298f2da9722";
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    private void docker(Path root,Path log,String... arguments) throws Exception {
        var command=new java.util.ArrayList<String>();command.add("docker");command.addAll(List.of(arguments));
        var process=new ProcessBuilder(command).directory(root.toFile()).redirectErrorStream(true).redirectOutput(log.toFile()).start();
        try {
            if(!process.waitFor(600,TimeUnit.SECONDS)) throw new IllegalStateException("Docker fixture timed out; inspect "+log);
            var lines=Files.readAllLines(log);
            assertThat(process.exitValue()).as(String.join("\n",lines.subList(Math.max(0,lines.size()-35),lines.size()))).isZero();
        } finally {
            if(process.isAlive()) {
                process.descendants().forEach(ProcessHandle::destroyForcibly);
                process.destroyForcibly();process.waitFor(10,TimeUnit.SECONDS);
            }
        }
    }
    private void provision(PostgreSQLContainer db) throws Exception {
        db.copyFileToContainer(MountableFile.forHostPath("ops/bootstrap-roles.sql"),"/tmp/bootstrap-roles.sql");
        var result=db.execInContainer("env","PGPASSWORD="+db.getPassword(),"psql","-h","127.0.0.1","-U",db.getUsername(),"-d",db.getDatabaseName(),
            "-v","ON_ERROR_STOP=1","-f","/tmp/bootstrap-roles.sql","-c","""
            CREATE ROLE app_domain LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'fixture-domain';
            CREATE ROLE app_identity LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'fixture-identity';
            GRANT ritmo_domain TO app_domain; GRANT ritmo_identity TO app_identity;
            """);
        assertThat(result.getExitCode()).as(result.getStderr()).isZero();
    }
    private GenericContainer<?> api(String image,Network network,PostgreSQLContainer db,Map<String,String> overrides) {
        var env=new LinkedHashMap<String,String>();
        env.put("RITMO_DB_URL","jdbc:postgresql://db:5432/"+db.getDatabaseName()+"?connectTimeout=5&socketTimeout=10");
        env.put("RITMO_MIGRATION_USER",db.getUsername());env.put("RITMO_MIGRATION_PASSWORD",db.getPassword());
        env.put("RITMO_DB_USER","app_domain");env.put("RITMO_DB_PASSWORD","fixture-domain");
        env.put("RITMO_IDENTITY_USER","app_identity");env.put("RITMO_IDENTITY_PASSWORD","fixture-identity");
        env.put("RITMO_SIGNING_KEY",Base64.getEncoder().encodeToString(new byte[32]));
        env.put("LOGGING_LEVEL_ROOT","ERROR");env.put("RITMO_WAL_WAIT_MS","250");env.putAll(overrides);
        return new GenericContainer<>(image).withNetwork(network).withExposedPorts(8080).withEnv(env)
            .waitingFor(Wait.forHttp("/api/v1/sync/pull").withHeader("X-Ritmo-Protocol","m1.1").withHeader("X-App-Version","0.1.0").forStatusCode(503).withStartupTimeout(Duration.ofSeconds(90)));
    }
    private JsonNode post(GenericContainer<?> api,String path,String token,JsonNode body,int expected) throws Exception {
        var request=HttpRequest.newBuilder(URI.create("http://"+api.getHost()+":"+api.getMappedPort(8080)+"/api/v1/"+path))
            .timeout(Duration.ofSeconds(20)).header("Content-Type","application/json")
            .header("X-Ritmo-Protocol","m1.1").header("X-App-Version","0.1.0").header("Idempotency-Key",Json.id());
        if(token!=null) request.header("Authorization","Bearer "+token);
        var response=http.send(request.POST(HttpRequest.BodyPublishers.ofString(body.toString())).build(),HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(response.body()).isEqualTo(expected);
        return response.body().isEmpty()?Json.object():Json.read(response.body());
    }
    private JsonNode registration() {
        return Json.object().put("email","package@example.test").put("password","fixture-password").put("displayName","Package fixture").put("deviceId",Json.id());
    }
    @Test @Timeout(900)
    void packagedApiIncludesItsContractAndMigrationsAndDefaultsToQuarantineAndWalProtection() throws Exception {
        Path root=Path.of("..").toAbsolutePath().normalize();Path logs=Path.of("build").toAbsolutePath();Files.createDirectories(logs);
        String image="ritmo-api-fixture:"+UUID.randomUUID();boolean built=false;
        try {
            docker(root,logs.resolve("container-build.log"),"build","--file","api/Dockerfile","--tag",image,".");built=true;
            try(var network=Network.newNetwork();var db=new PostgreSQLContainer(POSTGRES).withNetwork(network).withNetworkAliases("db")
                .withCommand("postgres","-c","fsync=on","-c","full_page_writes=on","-c","synchronous_commit=on")) {
                db.start();provision(db);
                try(var quarantined=api(image,network,db,Map.of())) {
                    quarantined.start();
                    assertThat(quarantined.execInContainer("id","-u").getStdout().trim()).isEqualTo("10001");
                    assertThat(post(quarantined,"auth/register",null,registration(),503).at("/error/code").asString()).isEqualTo("temporarily_unavailable");
                }
                try(var protectedApi=api(image,network,db,Map.of("RITMO_RECOVERY_QUARANTINE","false"))) {
                    protectedApi.start();
                    assertThat(post(protectedApi,"auth/register",null,registration(),503).at("/error/code").asString()).isEqualTo("temporarily_unavailable");
                }
                // Solely a disposable packaging fixture; production must never opt out of durable WAL.
                try(var disposable=api(image,network,db,Map.of("RITMO_RECOVERY_QUARANTINE","false","RITMO_REQUIRE_WAL","false"))) {
                    disposable.waitingFor(Wait.forHttp("/api/v1/sync/pull").withHeader("X-Ritmo-Protocol","m1.1").withHeader("X-App-Version","0.1.0").forStatusCode(401).withStartupTimeout(Duration.ofSeconds(90)));
                    disposable.start();
                    var account=post(disposable,"auth/register",null,registration(),201);
                    assertThat(account.path("accessToken").asString()).isNotBlank();
                    assertThat(account.path("refreshToken").asString()).isNotBlank();
                    assertThat(account.path("revokeToken").asString()).isNotBlank();
                    assertThat(post(disposable,"sync/snapshots",account.path("accessToken").asString(),Json.object(),201).path("snapshotId").asString()).isNotBlank();
                }
            }
        } finally {
            if(built) docker(root,logs.resolve("container-cleanup.log"),"image","rm",image);
        }
    }
}
