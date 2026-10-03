"""Public primary probe through real SSH/sudo, PG18/TLS and a disposable filesystem."""
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import pwd
import shutil
import subprocess
import sys
import time
import unittest
sys.path.insert(0,"/opt/ritmo")
from probe_transport import fetch
from operations import write_json
from mail import Mail

BIN="/usr/lib/postgresql/18/bin"
def run(*args):
    return subprocess.run(args,check=True,capture_output=True,timeout=20)

class PrimaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root=root=Path("/etc/ritmo");root.mkdir(mode=0o700,exist_ok=True)
        cls.owner=pwd.getpwnam("postgres")
        base=Path("/srv/ritmo-primary");base.mkdir(mode=0o755)
        os.chown(base,cls.owner.pw_uid,cls.owner.pw_gid)
        cls.data=base/"data";cls.wal=cls.data/"pg_wal"
        cls.data.mkdir(mode=0o700)
        run("mount","-t","tmpfs","-o","size=128m","primary-fixture",str(cls.data))
        os.chown(cls.data,cls.owner.pw_uid,cls.owner.pw_gid);cls.data.chmod(0o700)
        run("runuser","-u","postgres","--",BIN+"/initdb","-D",str(cls.data),"-A","trust","-U","fixture_owner")
        run("openssl","req","-x509","-newkey","rsa:2048","-nodes","-days","1","-keyout",str(cls.data/"server.key"),
            "-out",str(root/"pg-ca.pem"),"-subj","/CN=localhost","-addext","subjectAltName=DNS:localhost,IP:127.0.0.1")
        (cls.data/"server.crt").write_bytes((root/"pg-ca.pem").read_bytes())
        for name in ("server.key","server.crt"):
            os.chown(cls.data/name,cls.owner.pw_uid,cls.owner.pw_gid);(cls.data/name).chmod(0o600)
        with (cls.data/"postgresql.conf").open("a") as stream:
            stream.write("\nlisten_addresses='127.0.0.1'\nport=5543\nssl=on\nfsync=on\nfull_page_writes=on\nwal_level=replica\nmax_replication_slots=4\nmax_wal_senders=4\n")
        run("runuser","-u","postgres","--",BIN+"/pg_ctl","-D",str(cls.data),"-l",str(cls.data/"fixture.log"),"-w","start")
        run(BIN+"/psql","--no-password","-X","-h","127.0.0.1","-p","5543","-U","fixture_owner","-d","postgres","-f","/opt/ritmo/primary-probe-role.sql")
        cls.sql("CREATE ROLE ritmo_wal_receiver LOGIN REPLICATION; "
            "CREATE SCHEMA fixture_private; CREATE TABLE fixture_private.secret(value text); "
            "SELECT pg_create_physical_replication_slot('ritmo_wal',true);")
        archive=base/"archive";archive.mkdir(mode=0o700)
        cls.receiver=subprocess.Popen([BIN+"/pg_receivewal","-h","127.0.0.1","-p","5543","-U","ritmo_wal_receiver",
            "-D",str(archive),"--slot=ritmo_wal","--synchronous","--no-password","--status-interval=1"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        for _ in range(100):
            if cls.sql("SELECT active FROM pg_replication_slots WHERE slot_name='ritmo_wal'").strip()==b"t": break
            time.sleep(.05)
        else: raise RuntimeError("fixture_receiver_not_ready")
        cls.sql("ALTER SYSTEM SET synchronous_standby_names='FIRST 1 (ritmo_wal)'")
        cls.sql("SELECT pg_reload_conf()")
        (root/"pgpass").write_text("127.0.0.1:5543:postgres:ritmo_primary_probe:fixture-unused");(root/"pgpass").chmod(0o600)
        write_json(root/"primary-env.json",{"PGHOST":"127.0.0.1","PGPORT":"5543","PGDATABASE":"postgres",
            "PGUSER":"ritmo_primary_probe","PGAPPNAME":"ritmo_primary_probe","PGSSLMODE":"verify-full",
            "PGSSLROOTCERT":str(root/"pg-ca.pem"),"PGPASSFILE":str(root/"pgpass"),"PGCONNECT_TIMEOUT":"2"})
        cls.mail=Mail(str(root/"pg-ca.pem"),str(cls.data/"server.key"))
        (root/"smtp-password").write_text("fixture-token");(root/"smtp-password").chmod(0o600)
        write_json(root/"smtp.json",{"host":"127.0.0.1","port":cls.mail.server_address[1],"sender":"ops@example.test",
            "recipients":["owner@example.test"],"messageIdDomain":"example.test","username":"fixture",
            "passwordFile":str(root/"smtp-password"),"caFile":str(root/"pg-ca.pem")})
        cls.collector={"dataPath":str(cls.data),"walPath":str(cls.wal),"dataOwnerUid":cls.owner.pw_uid,
            "binaryDir":BIN,"environmentFile":str(root/"primary-env.json")}
        write_json(root/"primary.json",cls.collector)
        write_json(root/"probe-export.json",{"kind":"primary"})
        run("ssh-keygen","-q","-t","ed25519","-N","","-f",str(root/"key"))
        Path("/etc/ssh/ritmo-probe.keys").write_text('restrict,from="127.0.0.1" '+(root/"key.pub").read_text())
        for wrapper in ("probe-command","fetch-primary"): os.chmod("/opt/ritmo/"+wrapper,0o755)
        Path("/etc/sudoers.d/ritmo-probe").write_text(Path("/opt/ritmo/ritmo-probe.sudoers").read_text())
        Path("/etc/sudoers.d/ritmo-probe").chmod(0o440);run("visudo","-cf","/etc/sudoers.d/ritmo-probe")
        Path("/run/sshd").mkdir(exist_ok=True)
        ssh=Path("/etc/ssh/primary-fixture.conf")
        ssh.write_text("Port 2242\nListenAddress 127.0.0.1\nHostKey /etc/ssh/ssh_host_ed25519_key\nPidFile /run/primary-sshd.pid\nPermitUserEnvironment no\n"
            +Path("/opt/ritmo/ritmo-probe-sshd.conf").read_text())
        run("/usr/sbin/sshd","-t","-f",str(ssh));run("/usr/sbin/sshd","-f",str(ssh))
        (root/"known_hosts").write_text("[127.0.0.1]:2242 "+Path("/etc/ssh/ssh_host_ed25519_key.pub").read_text())
        write_json(root/"primary-client.json",{"host":"127.0.0.1","port":2242,"keyFile":str(root/"key"),
            "knownHostsFile":str(root/"known_hosts"),"kind":"primary","timeout":10})

    @classmethod
    def sql(cls,query):
        return run(BIN+"/psql","--no-password","-XAt","-h","127.0.0.1","-p","5543","-U","fixture_owner","-d","postgres","-v","ON_ERROR_STOP=1","-c",query).stdout

    @classmethod
    def tearDownClass(cls):
        cls.mail.close()
        cls.receiver.terminate();cls.receiver.wait(timeout=10)
        run("runuser","-u","postgres","--",BIN+"/pg_ctl","-D",str(cls.data),"-w","-m","immediate","stop")
        os.kill(int(Path("/run/primary-sshd.pid").read_text()),15)

    def test_primary_collects_real_cluster_storage_and_slot_without_domain_access(self):
        report=fetch(self.root/"primary-client.json")
        self.assertEqual(report["kind"],"primary")
        self.assertTrue(report["database"]);self.assertTrue(report["durable"]);self.assertTrue(report["slot"]["healthy"])
        self.assertGreaterEqual(report["slot"]["retainedBytes"],0)
        self.assertGreater(report["storage"]["data"],0);self.assertGreater(report["storage"]["wal"],0)
        self.assertEqual(set(report),{"version","kind","at","database","durable","slot","storage"})
        self.assertFalse(any(word in json.dumps(report) for word in ("fixture_owner","pgpass","/srv","SELECT")))
        denied=subprocess.run([BIN+"/psql","--no-password","-XAt","-h","127.0.0.1","-p","5543",
            "-U","ritmo_primary_probe","-d","postgres","-v","ON_ERROR_STOP=1","-c","SELECT * FROM fixture_private.secret"],capture_output=True,timeout=5)
        self.assertNotEqual(denied.returncode,0)

    def test_changed_synchronism_is_reported_without_repairing_configuration(self):
        self.sql("ALTER SYSTEM SET synchronous_standby_names=''")
        self.sql("SELECT pg_reload_conf()")
        try:
            report=fetch(self.root/"primary-client.json")
            self.assertTrue(report["database"]);self.assertFalse(report["durable"])
            self.assertTrue(report["slot"]["healthy"])
            self.assertEqual(self.sql("SHOW synchronous_standby_names").strip(),b"")
        finally:
            self.sql("ALTER SYSTEM SET synchronous_standby_names='FIRST 1 (ritmo_wal)'")
            self.sql("SELECT pg_reload_conf()")

    def test_native_monitor_collects_primary_even_when_receiver_transport_is_unavailable(self):
        folder=Path("/srv/ritmo-monitor");folder.mkdir(mode=0o700,exist_ok=True)
        # The receiver direction reaches a different metadata role and is refused.
        # Primary uses its independent authenticated path and real PG/filesystem.
        receiver=json.loads((self.root/"primary-client.json").read_text())
        write_json(self.root/"probe-client.json",{**receiver,"kind":"receiver"})
        os.chmod("/opt/ritmo/fetch-probe",0o755)
        for name in ("ritmo-monitor.service","ritmo-monitor.timer"):
            Path("/etc/systemd/system",name).write_text(Path("/opt/ritmo",name).read_text())
        run("systemctl","daemon-reload")
        run("systemd-analyze","verify","/etc/systemd/system/ritmo-monitor.service","/etc/systemd/system/ritmo-monitor.timer")
        try:
            run("systemctl","start","ritmo-monitor.service")
            first=json.loads((folder/"state.json").read_text())
            primary=json.loads((folder/"primary-state.json").read_text())
            self.assertEqual(first["consecutive"]["receiver-host"],1)
            self.assertEqual({key:primary["consecutive"][key] for key in
                ("primary-host","primary-database","primary-durability","primary-slot")},
                {"primary-host":0,"primary-database":0,"primary-durability":0,"primary-slot":0})
            for name in ("state.json","primary-state.json"):
                self.assertEqual((folder/name).stat().st_mode & 0o777,0o600)
            evidence=json.loads(Path("/var/lib/ritmo-jobs/monitor.json").read_text())
            self.assertEqual(evidence["result"],"success");self.assertIsNone(evidence["attempt"])
        finally:
            run("systemctl","stop","ritmo-monitor.service")
            for name in ("state.json","primary-state.json"): (folder/name).unlink(missing_ok=True)

    def test_real_filesystem_pressure_reaches_cli_and_delivers_tls_alerts(self):
        state=Path("/srv/ritmo-monitor/primary-state.json")
        command=["/usr/bin/python3","/opt/ritmo/operations.py","monitor","--source","primary","--state",str(state),
            "--probe-command","/opt/ritmo/fetch-primary","--smtp-config",str(self.root/"smtp.json"),"--interval","1"]
        def collect():
            result=run(*command);time.sleep(1.05);return json.loads(result.stdout)
        def pressure(target):
            devices=set()
            for folder in (self.data,self.wal):
                if folder.stat().st_dev in devices: continue
                devices.add(folder.stat().st_dev)
                filler=folder/".fixture-pressure";filler.unlink(missing_ok=True)
                volume=os.statvfs(folder);total=volume.f_blocks*volume.f_frsize;used=total-volume.f_bfree*volume.f_frsize
                with filler.open("wb") as stream: os.posix_fallocate(stream.fileno(),0,int(total*target/100)-used)
        try:
            pressure(85);self.assertEqual({(e["code"],e["level"]) for e in collect()},
                {("primary-data-storage",1),("primary-wal-storage",1)})
            pressure(95);self.assertEqual({(e["code"],e["level"]) for e in collect()},
                {("primary-data-storage",2),("primary-wal-storage",2)})
            self.assertEqual(collect(),[])
        finally:
            for folder in (self.data,self.wal): (folder/".fixture-pressure").unlink(missing_ok=True)
        self.assertEqual({(e["code"],e["level"]) for e in collect()},
            {("primary-data-storage",0),("primary-wal-storage",0)})
        self.assertEqual(len(self.mail.messages),6)
        self.assertEqual(len({m["Message-ID"] for m in self.mail.messages}),6)
        self.assertTrue(all("fixture-token" not in m.get_content() and "/srv" not in m.get_content() for m in self.mail.messages))

    def test_retention_grows_without_a_consumer_and_lost_or_absent_slot_is_not_healthy(self):
        receiver=type(self).receiver;command=list(receiver.args)
        receiver.terminate();receiver.wait(timeout=10)
        try:
            before=fetch(self.root/"primary-client.json")
            self.assertFalse(before["slot"]["active"]);self.assertFalse(before["slot"]["healthy"])
            self.sql("SELECT pg_logical_emit_message(false,'fixture',repeat('x',8388608),true)")
            after=fetch(self.root/"primary-client.json")
            self.assertGreaterEqual(after["slot"]["retainedBytes"]-before["slot"]["retainedBytes"],8388608)
            self.assertEqual(fetch(self.root/"primary-client.json")["slot"]["retainedBytes"],after["slot"]["retainedBytes"])
            for query in ("ALTER SYSTEM SET max_slot_wal_keep_size='0'","ALTER SYSTEM SET min_wal_size='16MB'",
                          "ALTER SYSTEM SET max_wal_size='32MB'","SELECT pg_reload_conf()"):
                self.sql(query)
            for _ in range(3): self.sql("SELECT pg_switch_wal(); CHECKPOINT")
            lost=fetch(self.root/"primary-client.json")["slot"]
            self.assertEqual(lost["status"],"lost");self.assertTrue(lost["invalidated"]);self.assertFalse(lost["healthy"])
            self.sql("SELECT pg_drop_replication_slot('ritmo_wal')")
            absent=fetch(self.root/"primary-client.json")["slot"]
            self.assertFalse(absent["present"]);self.assertFalse(absent["healthy"]);self.assertIsNone(absent["retainedBytes"])
        finally:
            for query in ("ALTER SYSTEM RESET max_slot_wal_keep_size","ALTER SYSTEM RESET min_wal_size",
                          "ALTER SYSTEM RESET max_wal_size","SELECT pg_reload_conf()"):
                self.sql(query)
            self.sql("SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots WHERE slot_name='ritmo_wal'")
            self.sql("SELECT pg_create_physical_replication_slot('ritmo_wal',true)")
            archive=self.data.parent/"fresh-archive";archive.mkdir(mode=0o700)
            command[command.index("-D")+1]=str(archive)
            type(self).receiver=subprocess.Popen(command,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            for _ in range(100):
                if self.sql("SELECT active FROM pg_replication_slots WHERE slot_name='ritmo_wal'").strip()==b"t": break
                time.sleep(.05)
            else: raise RuntimeError("fixture_receiver_not_resumed")

    def test_primary_refuses_wrong_cluster_mount_or_permissions_and_sql_failure_is_unknown(self):
        foreign=Path("/srv/ritmo-foreign");foreign.mkdir(mode=0o700)
        run("mount","-t","tmpfs","-o","size=128m","foreign-fixture",str(foreign))
        os.chown(foreign,self.owner.pw_uid,self.owner.pw_gid);foreign.chmod(0o700)
        run("runuser","-u","postgres","--",BIN+"/initdb","-D",str(foreign),"-A","trust")
        alias=Path("/srv/primary-alias");alias.symlink_to(self.data)
        try:
            for change in ({"dataPath":str(foreign),"walPath":str(foreign/"pg_wal")},
                           {"walPath":"/srv/no-such-mount"},{"dataPath":str(alias)}):
                write_json(self.root/"primary.json",{**self.collector,**change},replace=True)
                with self.assertRaises(RuntimeError): fetch(self.root/"primary-client.json")
            write_json(self.root/"primary.json",self.collector,replace=True)
            self.data.chmod(0o777)
            try:
                with self.assertRaises(RuntimeError): fetch(self.root/"primary-client.json")
            finally: self.data.chmod(0o700)
            environment=json.loads((self.root/"primary-env.json").read_text())
            write_json(self.root/"primary-env.json",{**environment,"PGPORT":"5999"},replace=True)
            try:
                report=fetch(self.root/"primary-client.json")
                self.assertFalse(report["database"]);self.assertIsNone(report["durable"]);self.assertIsNone(report["slot"])
                self.assertGreater(report["storage"]["data"],0)
            finally: write_json(self.root/"primary-env.json",environment,replace=True)
        finally:
            write_json(self.root/"primary.json",self.collector,replace=True);alias.unlink()
