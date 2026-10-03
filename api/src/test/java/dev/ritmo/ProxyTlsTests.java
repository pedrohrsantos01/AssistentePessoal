package dev.ritmo;

import dev.ritmo.shared.Json;
import java.nio.file.*;
import java.security.KeyStore;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.Network;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.MountableFile;
import tools.jackson.databind.JsonNode;
import static org.assertj.core.api.Assertions.*;

/** Actual packaged API behind a real TLS edge; clients cannot reach its private network. */
class ProxyTlsTests {
    private static final String POSTGRES="postgres@sha256:5a5a84b19854a9ffaa54082c166ff4ec27473a361e496e5ea167f298f2da9722";
    private static final String TRAEFIK="traefik@sha256:aaf0f6185419a50c74651448c1a5bf4606bd2d2ddb7b8749eed505d55bf8b8ea";
    private static final String CLIENT="node@sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f";
    private void docker(Path root,Path log,String... args) throws Exception {
        var command=new ArrayList<String>();command.add("docker");command.addAll(List.of(args));
        var process=new ProcessBuilder(command).directory(root.toFile()).redirectErrorStream(true).redirectOutput(log.toFile()).start();
        try {
            assertThat(process.waitFor(600,TimeUnit.SECONDS)).as("Docker deadline: %s",log).isTrue();
            assertThat(process.exitValue()).as("Docker fixture: %s",Files.readString(log)).isZero();
        } finally {
            if(process.isAlive()) {process.descendants().forEach(ProcessHandle::destroyForcibly);process.destroyForcibly();process.waitFor(10,TimeUnit.SECONDS);}
        }
    }
    private void certificate(Path fixture) throws Exception {
        String keytool=Path.of(System.getProperty("java.home"),"bin",System.getProperty("os.name").toLowerCase().contains("windows")?"keytool.exe":"keytool").toString();
        var process=new ProcessBuilder(keytool,"-genkeypair","-alias","fixture","-keyalg","RSA","-keysize","2048",
            "-dname","CN=api.example.test","-ext","SAN=dns:api.example.test","-ext","bc=ca:true","-validity","2",
            "-storetype","PKCS12","-keystore",fixture.resolve("fixture.p12").toString(),"-storepass","fixture-password")
            .redirectErrorStream(true).redirectOutput(fixture.resolve("keytool.log").toFile()).start();
        try {
            assertThat(process.waitFor(30,TimeUnit.SECONDS)).isTrue();assertThat(process.exitValue()).isZero();
        } finally {if(process.isAlive()) {process.destroyForcibly();process.waitFor(5,TimeUnit.SECONDS);}}
        var store=KeyStore.getInstance("PKCS12");
        try(var input=Files.newInputStream(fixture.resolve("fixture.p12"))) {store.load(input,"fixture-password".toCharArray());}
        var encoder=Base64.getMimeEncoder(64,new byte[]{10});
        Files.writeString(fixture.resolve("ritmo.crt"),"-----BEGIN CERTIFICATE-----\n"+encoder.encodeToString(store.getCertificate("fixture").getEncoded())+"\n-----END CERTIFICATE-----\n");
        Files.writeString(fixture.resolve("ritmo.key"),"-----BEGIN PRIVATE KEY-----\n"+encoder.encodeToString(store.getKey("fixture","fixture-password".toCharArray()).getEncoded())+"\n-----END PRIVATE KEY-----\n");
    }
    private void provision(GenericContainer<?> db) throws Exception {
        db.copyFileToContainer(MountableFile.forHostPath("ops/bootstrap-roles.sql"),"/tmp/bootstrap.sql");
        var result=db.execInContainer("psql","-U","postgres","-d","ritmo","-v","ON_ERROR_STOP=1","-f","/tmp/bootstrap.sql","-c","""
            CREATE ROLE app_domain LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'fixture-domain';
            CREATE ROLE app_identity LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'fixture-identity';
            GRANT ritmo_domain TO app_domain; GRANT ritmo_identity TO app_identity;
            """);
        assertThat(result.getExitCode()).as(result.getStderr()).isZero();
    }
    private GenericContainer<?> api(String image,Network network,String peer,Map<String,String> overrides) {
        var env=new LinkedHashMap<String,String>();
        env.put("RITMO_DB_URL","jdbc:postgresql://db:5432/ritmo?connectTimeout=5&socketTimeout=10");
        env.put("RITMO_MIGRATION_USER","postgres");env.put("RITMO_MIGRATION_PASSWORD","fixture-postgres");
        env.put("RITMO_DB_USER","app_domain");env.put("RITMO_DB_PASSWORD","fixture-domain");
        env.put("RITMO_IDENTITY_USER","app_identity");env.put("RITMO_IDENTITY_PASSWORD","fixture-identity");
        env.put("RITMO_SIGNING_KEY",Base64.getEncoder().encodeToString(new byte[32]));
        env.put("RITMO_TRUSTED_PROXY_PEERS",peer);
        env.put("RITMO_RATE_LOGIN_CAPACITY","2");env.put("RITMO_RATE_LOGIN_PERIOD_SECONDS","86400");
        env.putAll(overrides);
        return new GenericContainer<>(image).withNetwork(network).withNetworkAliases("ritmo-api").withEnv(env)
            .waitingFor(Wait.forLogMessage(".*Started RitmoApplication.*\\n",1).withStartupTimeout(Duration.ofSeconds(90)));
    }
    private GenericContainer<?> client(Network network,Path fixture) {
        return new GenericContainer<>(CLIENT).withNetwork(network)
            .withCopyFileToContainer(MountableFile.forHostPath("src/test/fixtures/proxy/client.mjs"),"/fixture/client.mjs")
            .withCopyFileToContainer(MountableFile.forHostPath(fixture.resolve("ritmo.crt")),"/fixture/ritmo.crt")
            .withCommand("node","-e","console.log('fixture_ready');setInterval(()=>{},1000)")
            .waitingFor(Wait.forLogMessage(".*fixture_ready.*\\n",1));
    }
    private JsonNode request(GenericContainer<?> client,JsonNode options) throws Exception {
        var result=client.execInContainer("node","/fixture/client.mjs",options.toString());
        assertThat(result.getExitCode()).as(result.getStderr()).isZero();return Json.read(result.getStdout());
    }
    private void status(JsonNode response,int expected) {
        assertThat(response.path("status").asInt()).as(response.toString()).isEqualTo(expected);
        assertThat(response.at("/headers/strict-transport-security").asString()).isEqualTo("max-age=31536000");
    }
    @Test @Timeout(900)
    void tlsEdgeSanitizesOriginsPreservesQuotasErrorsAndPrivateBackend() throws Exception {
        Path root=Path.of("..").toAbsolutePath().normalize();Path logs=Path.of("build").toAbsolutePath();Files.createDirectories(logs);
        Path fixture=Files.createTempDirectory(logs,"proxy-");
        String image="ritmo-proxy-api-fixture:"+UUID.randomUUID();boolean built=false;
        try {
            certificate(fixture);
            docker(root,logs.resolve("proxy-build.log"),"build","-f","api/Dockerfile","-t",image,".");built=true;
            try(var backend=Network.newNetwork();var front=Network.newNetwork();
                var db=new GenericContainer<>(POSTGRES).withNetwork(backend).withNetworkAliases("db")
                    .withEnv(Map.of("POSTGRES_USER","postgres","POSTGRES_PASSWORD","fixture-postgres","POSTGRES_DB","ritmo"))
                    .waitingFor(Wait.forLogMessage(".*database system is ready to accept connections.*\\n",2))) {
                db.start();provision(db);
                try(var edge=new GenericContainer<>(TRAEFIK).withNetwork(backend).withExposedPorts(80,443)
                    .withCopyFileToContainer(MountableFile.forHostPath("deploy/proxy/traefik-static.example.yml"),"/etc/traefik/traefik.yml")
                    .withCopyFileToContainer(MountableFile.forHostPath("deploy/proxy/ritmo-dynamic.example.yml"),"/etc/traefik/dynamic/ritmo.yml")
                    .withCopyFileToContainer(MountableFile.forHostPath(fixture.resolve("ritmo.crt")),"/etc/traefik/certs/ritmo.crt")
                    .withCopyFileToContainer(MountableFile.forHostPath(fixture.resolve("ritmo.key")),"/etc/traefik/certs/ritmo.key")
                    .waitingFor(Wait.forListeningPort().withStartupTimeout(Duration.ofSeconds(60)))) {
                    edge.start();
                    String peer=edge.getContainerInfo().getNetworkSettings().getNetworks().values().iterator().next().getIpAddress();
                    docker(root,logs.resolve("proxy-network.log"),"network","connect","--alias","api.example.test",front.getId(),edge.getContainerId());
                    try(var api=api(image,backend,peer,Map.of("RITMO_RECOVERY_QUARANTINE","false","RITMO_REQUIRE_WAL","false"));
                        var a=client(front,fixture);var b=client(front,fixture);var direct=client(backend,fixture)) {
                        api.start();a.start();b.start();direct.start();
                        assertThat(api.getContainerInfo().getHostConfig().getPortBindings().getBindings()).isNullOrEmpty();
                        assertThat(db.getContainerInfo().getHostConfig().getPortBindings().getBindings()).isNullOrEmpty();
                        assertThat(request(a,Json.object().put("scheme","http").put("hostname","ritmo-api").put("port",8080)).path("error").asString()).isEqualTo("ENOTFOUND");
                        assertThat(request(a,Json.object().put("trust",false)).path("error").asString()).isEqualTo("DEPTH_ZERO_SELF_SIGNED_CERT");
                        var redirect=request(a,Json.object().put("scheme","http").put("get",true).set("headers",Json.object()
                            .put("X-Forwarded-Proto","https").put("X-Forwarded-Host","attacker.example.test")));
                        assertThat(redirect.path("status").asInt()).isEqualTo(301);
                        assertThat(redirect.at("/headers/location").asString()).isEqualTo("https://api.example.test/api/v1/auth/login");
                        var unknown=request(a,Json.object().put("scheme","http").put("get",true).set("headers",Json.object().put("Host","unknown.example.test")));
                        assertThat(unknown.path("status").asInt()).as(unknown.toString()).isEqualTo(404);
                        status(request(a,Json.object().put("maxVersion","TLSv1.2")),401);
                        var spoof=Json.object().put("minVersion","TLSv1.3").set("headers",Json.object()
                            .put("X-Forwarded-For","192.0.2.91, 192.0.2.92").put("Forwarded","for=192.0.2.93;proto=http")
                            .put("X-Real-IP","192.0.2.94").put("X-Forwarded-Proto","http").put("X-Forwarded-Host","attacker.example.test"));
                        status(request(a,spoof),401);
                        spoof.set("headers",Json.object().put("X-Forwarded-For","198.51.100.90"));
                        var blocked=request(a,spoof);status(blocked,429);
                        assertThat(blocked.at("/headers/retry-after").asString()).isNotBlank();
                        assertThat(Json.read(blocked.path("body").asString()).at("/error/code").asString()).isEqualTo("rate_limited");
                        var privateOptions=Json.object().put("scheme","http").put("hostname","ritmo-api").put("port",8080)
                            .set("headers",Json.object().put("X-Forwarded-For","192.0.2.200").put("X-Forwarded-Proto","https"));
                        var privateResponse=request(direct,privateOptions);
                        assertThat(privateResponse.path("status").asInt()).isEqualTo(401);
                        assertThat(privateResponse.at("/headers/strict-transport-security").isMissingNode()).isTrue();
                        privateOptions.set("headers",Json.object().put("X-Forwarded-For","192.0.2.201"));
                        assertThat(request(direct,privateOptions).path("status").asInt()).isEqualTo(401);
                        privateOptions.set("headers",Json.object().put("X-Forwarded-For","192.0.2.202"));
                        assertThat(request(direct,privateOptions).path("status").asInt()).isEqualTo(429);
                        status(request(b,Json.object()),401);
                        status(request(b,Json.object().put("get",true).put("path","/api/v1/sync/pull")),401);
                    }
                    try(var quarantined=api(image,backend,peer,Map.of());var c=client(front,fixture)) {
                        c.start();var unavailable=request(c,Json.object());
                        assertThat(unavailable.path("status").asInt()).as(unavailable.toString()).isIn(502,504);
                        assertThat(unavailable.at("/headers/strict-transport-security").asString()).isEqualTo("max-age=31536000");
                        quarantined.start();var response=request(c,Json.object());status(response,503);
                        assertThat(Json.read(response.path("body").asString()).at("/error/code").asString()).isEqualTo("temporarily_unavailable");
                    }
                }
                for(var invalid:List.of(Map.of("SERVER_TOMCAT_REMOTEIP_REMOTE_IP_HEADER","X-Forwarded-For"),
                        Map.of("SERVER_TOMCAT_REMOTEIP_PROTOCOL_HEADER","X-Forwarded-Proto"),Map.of("RITMO_TRUSTED_PROXY_PEERS","172.16.0.0/12"),
                        Map.of("RITMO_TRUSTED_PROXY_PEERS","proxy.example.test"),Map.of("SERVER_FORWARD_HEADERS_STRATEGY","native"))) {
                    try(var api=api(image,backend,"",invalid)) {
                        String marker=invalid.containsKey("RITMO_TRUSTED_PROXY_PEERS")?"invalid_trusted_proxy_peer":"generic_forwarding_forbidden";
                        var refusal=new java.util.concurrent.CompletableFuture<Boolean>();
                        api.withLogConsumer(frame->{if(frame.getUtf8String().contains(marker)) refusal.complete(true);});
                        api.waitingFor(Wait.forLogMessage(".*Started RitmoApplication.*\\n",1).withStartupTimeout(Duration.ofSeconds(20)));
                        assertThatThrownBy(api::start).isInstanceOf(org.testcontainers.containers.ContainerLaunchException.class);
                        assertThat(refusal.get(5,TimeUnit.SECONDS)).isTrue();
                    }
                }
            }
        } finally {
            try {if(built) docker(root,logs.resolve("proxy-cleanup.log"),"image","rm",image);}
            finally {
                // Delete only these generated files inside the verified fixture directory.
                assertThat(fixture.toAbsolutePath().normalize().startsWith(logs.normalize())).isTrue();
                for(var name:List.of("ritmo.key","ritmo.crt","fixture.p12","keytool.log")) Files.deleteIfExists(fixture.resolve(name));
                Files.deleteIfExists(fixture);
            }
        }
    }
}
