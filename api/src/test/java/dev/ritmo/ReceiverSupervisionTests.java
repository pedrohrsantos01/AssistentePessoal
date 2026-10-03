package dev.ritmo;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.Network;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.MountableFile;
import org.testcontainers.images.builder.Transferable;
import static org.assertj.core.api.Assertions.assertThat;

/** Finite fixtures: actual systemd PID 1, Linux locks/filesystem and PG18 over verified TLS. */
class ReceiverSupervisionTests {
    private static final String POSTGRES="postgres@sha256:5a5a84b19854a9ffaa54082c166ff4ec27473a361e496e5ea167f298f2da9722";
    private record Result(int exit,String output) {}
    private Result execute(GenericContainer<?> container,String... command) throws Exception {
        var result=container.execInContainer(command);
        return new Result(result.getExitCode(),(result.getStdout()+result.getStderr()).trim());
    }
    private String succeed(GenericContainer<?> container,String... command) throws Exception {
        var result=execute(container,command);assertThat(result.exit()).as("Command %s: %s",command[0],result.output()).isZero();return result.output();
    }
    private Result receiver(GenericContainer<?> container,String action) throws Exception {
        return execute(container,"python3","/opt/ritmo/receiver.py",action);
    }
    private String sql(PostgreSQLContainer db,String statement) throws Exception {
        return succeed(db,"env","PGPASSWORD="+db.getPassword(),"PGOPTIONS=-c synchronous_commit=local","psql","-h","127.0.0.1","-U",db.getUsername(),"-d",db.getDatabaseName(),"-XAt","-v","ON_ERROR_STOP=1","-c",statement);
    }
    private void build(String image) throws Exception {
        Path log=Path.of("build/receiver-image.log").toAbsolutePath();Files.createDirectories(log.getParent());
        var child=new ProcessBuilder("docker","build","-f","api/src/test/fixtures/receiver/Dockerfile","-t",image,".")
            .directory(Path.of("..").toFile()).redirectErrorStream(true).redirectOutput(log.toFile()).start();
        try {
            assertThat(child.waitFor(300,TimeUnit.SECONDS)).as("Receiver fixture build timeout: %s",log).isTrue();
            assertThat(child.exitValue()).as("Receiver fixture build: %s",log).isZero();
        } finally { if(child.isAlive()) {child.descendants().forEach(ProcessHandle::destroyForcibly);child.destroyForcibly();child.waitFor(10,TimeUnit.SECONDS);} }
    }
    private void copy(GenericContainer<?> container,String path,String content,int mode) {
        container.copyFileToContainer(Transferable.of(content.getBytes(StandardCharsets.UTF_8),mode),path);
    }
    private void prepare(PostgreSQLContainer db,GenericContainer<?> nativeHost) throws Exception {
        // Test-only credentials and certificate, generated inside the disposable database.
        succeed(db,"sh","-c","openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=primary -addext subjectAltName=DNS:primary -keyout /tmp/fixture-key.pem -out /tmp/fixture-ca.pem >/dev/null 2>&1; chown postgres:postgres /tmp/fixture-key.pem; chmod 600 /tmp/fixture-key.pem");
        sql(db,"ALTER SYSTEM SET ssl_cert_file='/tmp/fixture-ca.pem'");sql(db,"ALTER SYSTEM SET ssl_key_file='/tmp/fixture-key.pem'");sql(db,"ALTER SYSTEM SET ssl='on'");sql(db,"SELECT pg_reload_conf()");
        sql(db,"CREATE ROLE ritmo_wal_receiver LOGIN REPLICATION NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'fixture-wal'");
        sql(db,"SELECT pg_create_physical_replication_slot('ritmo_wal',true)");
        succeed(db,"sh","-c","printf '\nhostssl replication all 0.0.0.0/0 scram-sha-256\n' >> \"$PGDATA/pg_hba.conf\"");
        sql(db,"ALTER SYSTEM SET synchronous_standby_names='FIRST 1 (ritmo_wal)'");sql(db,"SELECT pg_reload_conf()");
        succeed(nativeHost,"sh","-c","install -d -o ritmo-receiver -g ritmo-receiver -m 700 /srv/ritmo-recovery /srv/ritmo-recovery/wal; install -d -o root -g ritmo-receiver -m 750 /etc/ritmo /var/lib/ritmo-receiver; touch /var/lib/ritmo-receiver/writer.lock /var/lib/ritmo-receiver/admin.lock; chown root:ritmo-receiver /var/lib/ritmo-receiver/*.lock; chmod 640 /var/lib/ritmo-receiver/*.lock");
        nativeHost.copyFileToContainer(MountableFile.forHostPath("ops"),"/opt/ritmo");
        copy(nativeHost,"/etc/ritmo/receiver.json","""
            {"root":"/srv/ritmo-recovery","control":"/var/lib/ritmo-receiver","binary":"/usr/lib/postgresql/18/bin/pg_receivewal","environmentFile":"/etc/ritmo/receiver-env.json"}
            """,0640);
        copy(nativeHost,"/etc/ritmo/receiver-env.json","""
            {"PGHOST":"primary","PGPORT":"5432","PGDATABASE":"test","PGUSER":"ritmo_wal_receiver","PGAPPNAME":"ritmo_wal","PGSSLMODE":"verify-full","PGSSLROOTCERT":"/etc/ritmo/ca.pem","PGPASSFILE":"/etc/ritmo/pgpass"}
            """,0640);
        copy(nativeHost,"/etc/ritmo/ca.pem",succeed(db,"cat","/tmp/fixture-ca.pem")+"\n",0644);
        copy(nativeHost,"/etc/ritmo/pgpass","primary:5432:*:ritmo_wal_receiver:fixture-wal\n",0600);
        succeed(nativeHost,"sh","-c","chown root:ritmo-receiver /etc/ritmo/*.json; chown ritmo-receiver:ritmo-receiver /etc/ritmo/pgpass; cp /opt/ritmo/ritmo-wal-receiver.service /etc/systemd/system/; systemd-analyze verify /etc/systemd/system/ritmo-wal-receiver.service; systemctl daemon-reload; systemctl enable ritmo-wal-receiver.service");
    }
    private void awaitReceiver(PostgreSQLContainer db,GenericContainer<?> nativeHost) {
        Awaitility.await().atMost(Duration.ofSeconds(20)).untilAsserted(()-> {
            assertThat(receiver(nativeHost,"state")).isEqualTo(new Result(0,"running"));
            assertThat(sql(db,"SELECT count(*) FROM pg_stat_replication r JOIN pg_stat_ssl s ON r.pid=s.pid WHERE r.application_name='ritmo_wal' AND r.usename='ritmo_wal_receiver' AND r.state='streaming' AND r.sync_state='sync' AND r.flush_lsn IS NOT NULL AND s.ssl")).isEqualTo("1");
        });
    }
    @FunctionalInterface
    private interface Scenario { void run(PostgreSQLContainer db,GenericContainer<?> nativeHost) throws Exception; }
    private void fixture(Scenario scenario) throws Exception {
        String image="ritmo-receiver-fixture:"+UUID.randomUUID();boolean built=false;
        try {
            build(image);built=true;
            try(var network=Network.newNetwork();var db=new PostgreSQLContainer(POSTGRES).withNetwork(network).withNetworkAliases("primary")
                .withCommand("postgres","-c","fsync=on","-c","full_page_writes=on","-c","synchronous_commit=on");
                var nativeHost=new GenericContainer<>(image).withNetwork(network)
                    .withCreateContainerCmdModifier(command->command.getHostConfig().withPrivileged(true).withCgroupnsMode("private").withTmpFs(Map.of("/run","rw","/run/lock","rw")))
                    .waitingFor(Wait.forSuccessfulCommand("systemctl show --property=Version").withStartupTimeout(Duration.ofSeconds(30)))) {
                db.start();nativeHost.start();prepare(db,nativeHost);
                try {scenario.run(db,nativeHost);} catch (Exception | AssertionError failure) {
                    var diagnosis=nativeHost.execInContainer("journalctl","--no-pager","-u","ritmo-wal-receiver.service","-u","fixture-freeze.service","-n","35");
                    var environment=nativeHost.execInContainer("systemctl","show","--property=Environment","fixture-freeze.service");
                    var verifier=nativeHost.execInContainer("ls","-l","/opt/fixture-bin/pg_verifybackup");
                    Files.writeString(Path.of("build/receiver-diagnosis.log"),diagnosis.getStdout()+environment.getStdout()+verifier.getStdout()+verifier.getStderr());throw failure;
                }
            }
        } finally {
            if(built) {
                var cleanup=new ProcessBuilder("docker","image","rm",image).redirectErrorStream(true).redirectOutput(Path.of("build/receiver-cleanup.log").toFile()).start();
                try {assertThat(cleanup.waitFor(20,TimeUnit.SECONDS)).isTrue();assertThat(cleanup.exitValue()).isZero();}
                finally {if(cleanup.isAlive()) cleanup.destroyForcibly();}
            }
        }
    }
    private String property(GenericContainer<?> nativeHost,String name) throws Exception {
        return succeed(nativeHost,"systemctl","show","--value","--property="+name,"ritmo-wal-receiver.service");
    }
    @Test @Timeout(420)
    void nativeReceiverReconnectsAndRestartsWithoutDiscardingItsPartialWal() throws Exception {
        fixture((db,nativeHost)-> {
            assertThat(receiver(nativeHost,"resume").exit()).isZero();awaitReceiver(db,nativeHost);
            String lsn=succeed(db,"env","PGPASSWORD="+db.getPassword(),"PGOPTIONS=-c synchronous_commit=on","psql","-h","127.0.0.1","-U",db.getUsername(),"-d",db.getDatabaseName(),"-XAt","-c","SELECT pg_logical_emit_message(true,'supervision-fixture','confirmed')");
            assertThat(sql(db,"SELECT bool_and(flush_lsn>='"+lsn+"'::pg_lsn) FROM pg_stat_replication WHERE application_name='ritmo_wal'")).isEqualTo("t");
            String partial=succeed(nativeHost,"sh","-c","find /srv/ritmo-recovery/wal -name '*.partial' -printf '%f\\n'");assertThat(partial).isNotEmpty();
            String pid=property(nativeHost,"MainPID");String backend=sql(db,"SELECT pid FROM pg_stat_replication WHERE application_name='ritmo_wal'");
            sql(db,"SELECT pg_terminate_backend(pid) FROM pg_stat_replication WHERE application_name='ritmo_wal'");
            Awaitility.await().atMost(Duration.ofSeconds(20)).until(()->!sql(db,"SELECT coalesce(string_agg(pid::text,','),'') FROM pg_stat_replication WHERE application_name='ritmo_wal'").equals(backend));
            awaitReceiver(db,nativeHost);assertThat(property(nativeHost,"MainPID")).isEqualTo(pid);
            succeed(nativeHost,"systemctl","kill","--kill-whom=main","--signal=SIGKILL","ritmo-wal-receiver.service");
            Awaitility.await().atMost(Duration.ofSeconds(20)).until(()->!property(nativeHost,"MainPID").equals(pid));awaitReceiver(db,nativeHost);
            assertThat(succeed(nativeHost,"sh","-c","find /srv/ritmo-recovery/wal -name '*.partial' -printf '%f\\n'")).isEqualTo(partial);
            // Restart while the source is unavailable: initial connection failure must also retry.
            db.getDockerClient().stopContainerCmd(db.getContainerId()).withTimeout(10).exec();
            succeed(nativeHost,"systemctl","kill","--kill-whom=main","--signal=SIGKILL","ritmo-wal-receiver.service");
            succeed(nativeHost,"sleep","8");
            assertThat(property(nativeHost,"ActiveState")).isEqualTo("active");
            db.getDockerClient().startContainerCmd(db.getContainerId()).exec();awaitReceiver(db,nativeHost);
        });
    }
    @Test @Timeout(420)
    void inhibitionSurvivesExplicitStartAndRebootAndExcludesResumeThroughoutRealFreeze() throws Exception {
        fixture((db,nativeHost)-> {
            assertThat(receiver(nativeHost,"resume").exit()).isZero();awaitReceiver(db,nativeHost);
            copy(nativeHost,"/etc/ritmo/backup-pgpass","primary:5432:*:"+db.getUsername()+":"+db.getPassword()+"\n",0600);
            copy(nativeHost,"/etc/ritmo/backup.json","{\"PGHOST\":\"primary\",\"PGPORT\":\"5432\",\"PGDATABASE\":\"test\",\"PGUSER\":\""+db.getUsername()+"\",\"PGSSLMODE\":\"verify-full\",\"PGSSLROOTCERT\":\"/etc/ritmo/ca.pem\",\"PGPASSFILE\":\"/etc/ritmo/backup-pgpass\"}",0600);
            succeed(nativeHost,"python3","/opt/ritmo/operations.py","--root","/srv/ritmo-recovery","--physical-env","/etc/ritmo/backup.json","--logical-env","/etc/ritmo/backup.json","backup");
            succeed(db,"env","PGPASSWORD="+db.getPassword(),"PGOPTIONS=-c synchronous_commit=on","psql","-h","127.0.0.1","-U",db.getUsername(),"-d",db.getDatabaseName(),"-XAt","-c","SELECT pg_logical_emit_message(true,'supervision-fixture','post-base')");
            assertThat(receiver(nativeHost,"inhibit").exit()).isZero();assertThat(receiver(nativeHost,"state")).isEqualTo(new Result(0,"stopped"));
            String files=succeed(nativeHost,"sh","-c","sha256sum /srv/ritmo-recovery/wal/*");
            execute(nativeHost,"systemctl","start","ritmo-wal-receiver.service");
            Awaitility.await().atMost(Duration.ofSeconds(5)).until(()->property(nativeHost,"ActiveState").equals("failed"));
            assertThat(property(nativeHost,"ExecMainStatus")).isEqualTo("78");assertThat(receiver(nativeHost,"state")).isEqualTo(new Result(0,"stopped"));
            nativeHost.getDockerClient().restartContainerCmd(nativeHost.getContainerId()).withTimeout(10).exec();
            Awaitility.await().atMost(Duration.ofSeconds(20)).untilAsserted(()->assertThat(receiver(nativeHost,"state")).isEqualTo(new Result(0,"stopped")));
            assertThat(succeed(nativeHost,"sh","-c","sha256sum /srv/ritmo-recovery/wal/*")).isEqualTo(files);
            // Pause the real external verifier to attempt resume while the real freeze job holds its leases.
            succeed(nativeHost,"mkdir","-p","/opt/fixture-bin");
            copy(nativeHost,"/opt/fixture-bin/pg_verifybackup","""
                #!/bin/sh
                touch /srv/verify-entered
                while [ ! -e /srv/verify-release ]; do sleep 0.1; done
                # A valid slow verification must not impose a 20s whole-freeze deadline.
                if [ ! -e /srv/verifier-delayed ]; then touch /srv/verifier-delayed; sleep 45; fi
                exec /usr/lib/postgresql/18/bin/pg_verifybackup "$@"
                """,0755);
            assertThat(execute(nativeHost,"env","RITMO_RECOVERY_QUARANTINE=true","python3","/opt/ritmo/operations.py","--root","/srv/ritmo-recovery","freeze").exit()).isNotZero();
            succeed(nativeHost,"systemd-run","--unit=fixture-freeze","--property=Type=exec","--setenv=RITMO_RECOVERY_QUARANTINE=true","--setenv=PATH=/opt/fixture-bin:/usr/lib/postgresql/18/bin:/usr/bin:/bin","/usr/bin/python3","/opt/ritmo/operations.py","--root","/srv/ritmo-recovery","--receiver-config","/etc/ritmo/receiver.json","freeze");
            Awaitility.await().atMost(Duration.ofSeconds(10)).until(()->execute(nativeHost,"test","-f","/srv/verify-entered").exit()==0);
            assertThat(receiver(nativeHost,"resume").exit()).isNotZero();
            execute(nativeHost,"systemctl","start","ritmo-wal-receiver.service");
            Awaitility.await().atMost(Duration.ofSeconds(5)).until(()->property(nativeHost,"MainPID").equals("0"));
            succeed(nativeHost,"touch","/srv/verify-release");
            Awaitility.await().atMost(Duration.ofSeconds(10)).until(()->execute(nativeHost,"test","-f","/srv/verifier-delayed").exit()==0);
            assertThat(receiver(nativeHost,"resume").exit()).isNotZero();
            // Covers verification, copying, hashing and fsync without changing the runtime deadline.
            Awaitility.await().atMost(Duration.ofSeconds(120)).untilAsserted(()-> {
                assertThat(succeed(nativeHost,"systemctl","show","--value","--property=ActiveState","fixture-freeze.service")).isEqualTo("inactive");
                assertThat(succeed(nativeHost,"systemctl","show","--value","--property=ExecMainStatus","fixture-freeze.service")).isEqualTo("0");
            });
            assertThat(succeed(nativeHost,"sh","-c","find /srv/ritmo-recovery/frozen -name inventory.json | wc -l")).isEqualTo("1");
            assertThat(receiver(nativeHost,"state")).isEqualTo(new Result(0,"stopped"));
            String frozen=succeed(nativeHost,"sh","-c","find /srv/ritmo-recovery/frozen -mindepth 1 -maxdepth 1 -type d");
            succeed(nativeHost,"env","RITMO_RECOVERY_QUARANTINE=true","python3","/opt/ritmo/operations.py","--root","/srv/ritmo-recovery","restore",frozen,"/tmp/restored");
            assertThat(succeed(nativeHost,"sh","-c","sha256sum /srv/ritmo-recovery/wal/*")).isEqualTo(files);
            assertThat(receiver(nativeHost,"resume").exit()).isZero();awaitReceiver(db,nativeHost);
        });
    }
    @Test @Timeout(420)
    void unknownOrImpostorProcessIsRefusedAndFatalStorageDoesNotRestartAutomatically() throws Exception {
        fixture((db,nativeHost)-> {
            assertThat(receiver(nativeHost,"inhibit").exit()).isZero();
            // A real unmanaged writer must invalidate a stopped service's otherwise plausible state.
            succeed(nativeHost,"systemd-run","--unit=fixture-orphan","--uid=ritmo-receiver","/usr/bin/env","PGHOST=primary","PGPORT=5432","PGUSER=ritmo_wal_receiver","PGAPPNAME=ritmo_wal","PGSSLMODE=verify-full","PGSSLROOTCERT=/etc/ritmo/ca.pem","PGPASSFILE=/etc/ritmo/pgpass","/usr/lib/postgresql/18/bin/pg_receivewal","--no-password","--synchronous","--slot=ritmo_wal","--directory=/srv/ritmo-recovery/wal");
            Awaitility.await().atMost(Duration.ofSeconds(10)).until(()->sql(db,"SELECT count(*) FROM pg_stat_replication WHERE application_name='ritmo_wal'").equals("1"));
            assertThat(receiver(nativeHost,"state").exit()).isNotZero();
            String validConfiguration=succeed(nativeHost,"cat","/etc/ritmo/receiver.json");
            copy(nativeHost,"/etc/ritmo/receiver.json",validConfiguration.replace("/srv/ritmo-recovery","/srv/../srv/ritmo-recovery"),0640);
            succeed(nativeHost,"chown","root:ritmo-receiver","/etc/ritmo/receiver.json");
            assertThat(receiver(nativeHost,"state").exit()).as("The same WAL directory remains live through an equivalent absolute path").isNotZero();
            copy(nativeHost,"/etc/ritmo/receiver.json",validConfiguration,0640);succeed(nativeHost,"chown","root:ritmo-receiver","/etc/ritmo/receiver.json");
            assertThat(execute(nativeHost,"env","RITMO_RECOVERY_QUARANTINE=true","python3","/opt/ritmo/operations.py","--root","/srv/ritmo-recovery","--receiver-config","/etc/ritmo/receiver.json","freeze").exit()).isNotZero();
            succeed(nativeHost,"systemctl","stop","fixture-orphan.service");
            assertThat(receiver(nativeHost,"state")).isEqualTo(new Result(0,"stopped"));
            String validEnvironment=succeed(nativeHost,"cat","/etc/ritmo/receiver-env.json");
            copy(nativeHost,"/etc/ritmo/receiver-env.json",validEnvironment.replace("\"primary\"","\"/tmp\""),0640);
            succeed(nativeHost,"chown","root:ritmo-receiver","/etc/ritmo/receiver-env.json");
            assertThat(receiver(nativeHost,"state").exit()).as("Unix sockets cannot satisfy this receiver's remote TLS contract").isNotZero();
            copy(nativeHost,"/etc/ritmo/receiver-env.json",validEnvironment,0640);succeed(nativeHost,"chown","root:ritmo-receiver","/etc/ritmo/receiver-env.json");
            succeed(nativeHost,"sh","-c","mv /etc/systemd/system/ritmo-wal-receiver.service /etc/ritmo/unit.saved; systemctl daemon-reload");
            assertThat(receiver(nativeHost,"state").exit()).isNotZero();
            succeed(nativeHost,"sh","-c","mv /etc/ritmo/unit.saved /etc/systemd/system/ritmo-wal-receiver.service; mkdir -p /etc/systemd/system/ritmo-wal-receiver.service.d");
            copy(nativeHost,"/etc/systemd/system/ritmo-wal-receiver.service.d/fixture.conf","[Service]\nExecStart=\nExecStart=/usr/bin/sleep 60\n",0644);
            succeed(nativeHost,"systemctl","daemon-reload");succeed(nativeHost,"systemctl","start","ritmo-wal-receiver.service");
            assertThat(receiver(nativeHost,"state").exit()).isNotZero();assertThat(receiver(nativeHost,"inhibit").exit()).isZero();
            succeed(nativeHost,"sh","-c","rm /etc/systemd/system/ritmo-wal-receiver.service.d/fixture.conf; systemctl daemon-reload");
            assertThat(receiver(nativeHost,"resume").exit()).isZero();awaitReceiver(db,nativeHost);
            succeed(nativeHost,"systemctl","stop","ritmo-wal-receiver.service");
            succeed(nativeHost,"sh","-c","chmod 500 /srv/ritmo-recovery/wal; systemctl start ritmo-wal-receiver.service");
            sql(db,"SELECT pg_switch_wal()");
            Awaitility.await().atMost(Duration.ofSeconds(10)).until(()->property(nativeHost,"ActiveState").equals("failed"));
            assertThat(property(nativeHost,"ExecMainStatus")).isEqualTo("1");
            String restarts=property(nativeHost,"NRestarts");succeed(nativeHost,"sleep","3");
            assertThat(property(nativeHost,"ActiveState")).isEqualTo("failed");assertThat(property(nativeHost,"NRestarts")).isEqualTo(restarts);
            assertThat(receiver(nativeHost,"inhibit").exit()).isZero();
            assertThat(receiver(nativeHost,"resume").exit()).isNotZero();
            assertThat(execute(nativeHost,"test","-f","/var/lib/ritmo-receiver/inhibited").exit()).isZero();
            succeed(nativeHost,"sh","-c","chmod 700 /srv/ritmo-recovery/wal");
            assertThat(receiver(nativeHost,"resume").exit()).isZero();awaitReceiver(db,nativeHost);
        });
    }
}
