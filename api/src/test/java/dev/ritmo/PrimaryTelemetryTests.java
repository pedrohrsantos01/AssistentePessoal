package dev.ritmo;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.MountableFile;
import static org.assertj.core.api.Assertions.assertThat;

/** Finite Linux fixture: public SSH probe, real PG18/TLS and native monitor. */
class PrimaryTelemetryTests {
    @Test @Timeout(420)
    void primaryStorageRetentionAndAvailabilityAreObservedPrivately() throws Exception {
        String image="ritmo-primary-fixture:"+UUID.randomUUID();
        Path log=Path.of("build/primary-image.log").toAbsolutePath();Files.createDirectories(log.getParent());
        var build=new ProcessBuilder("docker","build","-f","api/src/test/fixtures/transport/Dockerfile","-t",image,".")
            .directory(Path.of("..").toFile()).redirectErrorStream(true).redirectOutput(log.toFile()).start();
        try {
            assertThat(build.waitFor(240,TimeUnit.SECONDS)).as("Fixture build deadline: %s",log).isTrue();
            assertThat(build.exitValue()).as("Fixture build: %s",log).isZero();
            try(var host=new GenericContainer<>(image)
                .withCreateContainerCmdModifier(command->command.getHostConfig().withPrivileged(true).withCgroupnsMode("private").withTmpFs(Map.of("/run","rw","/run/lock","rw")))
                .waitingFor(Wait.forSuccessfulCommand("systemctl show --property=Version").withStartupTimeout(Duration.ofSeconds(30)))) {
                host.start();host.copyFileToContainer(MountableFile.forHostPath("ops"),"/opt/ritmo");
                host.copyFileToContainer(MountableFile.forHostPath("src/test/fixtures/transport"),"/opt/fixture");
                var result=host.execInContainer("python3","-m","unittest","discover","-s","/opt/fixture","-p","test_primary_linux.py","-v");
                Files.writeString(Path.of("build/primary-result.log"),result.getStdout()+result.getStderr());
                assertThat(result.getExitCode()).as("Primary proof: %s",result.getStdout()+result.getStderr()).isZero();
            }
        } finally {
            if(build.isAlive()) {build.descendants().forEach(ProcessHandle::destroyForcibly);build.destroyForcibly();build.waitFor(10,TimeUnit.SECONDS);}
            var cleanup=new ProcessBuilder("docker","image","rm",image).redirectErrorStream(true).redirectOutput(ProcessBuilder.Redirect.DISCARD).start();
            if(!cleanup.waitFor(20,TimeUnit.SECONDS)) {cleanup.destroyForcibly();cleanup.waitFor(5,TimeUnit.SECONDS);}
        }
    }
}