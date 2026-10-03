"""Real SSH/sudo/TLS. Only disposable credentials, loopback traffic and local mail."""
from datetime import datetime, timedelta, timezone
import json
import os
import pwd
from pathlib import Path
import subprocess
import sys
import time
import unittest

sys.path.insert(0, "/opt/ritmo")
from probe_transport import fetch, bounded_process
from operations import Monitor, SmtpEmail, write_json
from mail import Mail

def run(*args):
    return subprocess.run(args,check=True,capture_output=True,timeout=15)

class TransportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root=root=Path("/etc/ritmo");root.mkdir(mode=0o700,exist_ok=True)
        run("ssh-keygen","-q","-t","ed25519","-N","","-f",str(root/"client-key"))
        run("ssh-keygen","-q","-t","ed25519","-N","","-f",str(root/"untrusted-key"))
        Path("/etc/ssh/ritmo-probe.keys").write_text('restrict,from="127.0.0.1" '+(root/"client-key.pub").read_text())
        for wrapper in ("probe-command","fetch-probe","fetch-detector"):
            os.chmod("/opt/ritmo/"+wrapper,0o755)
        Path("/etc/sudoers.d/ritmo-probe").write_text(Path("/opt/ritmo/ritmo-probe.sudoers").read_text())
        os.chmod("/etc/sudoers.d/ritmo-probe",0o440)
        run("visudo","-cf","/etc/sudoers.d/ritmo-probe")
        Path("/run/sshd").mkdir(exist_ok=True)
        cls.daemons=[]
        for port,forced in ((2222,"/opt/ritmo/probe-command"),(2223,"/usr/bin/python3 /opt/fixture/payload.py")):
            sshconf=Path("/etc/ssh/fixture-"+str(port)+".conf")
            snippet=Path("/opt/ritmo/ritmo-probe-sshd.conf").read_text().replace("/opt/ritmo/probe-command",forced)
            sshconf.write_text("Port "+str(port)+"\nListenAddress 127.0.0.1\nHostKey /etc/ssh/ssh_host_ed25519_key\n"
                "PidFile /run/fixture-"+str(port)+".pid\nPermitUserEnvironment no\n"+snippet)
            run("/usr/sbin/sshd","-t","-f",str(sshconf));run("/usr/sbin/sshd","-f",str(sshconf))
            cls.daemons.append(Path("/run/fixture-"+str(port)+".pid"))
        (root/"known_hosts").write_text("".join("[127.0.0.1]:"+str(port)+" "+Path("/etc/ssh/ssh_host_ed25519_key.pub").read_text() for port in (2222,2223)))
        cls.values={"host":"127.0.0.1","port":2222,"keyFile":str(root/"client-key"),
            "knownHostsFile":str(root/"known_hosts"),"kind":"detector","timeout":10}
        cls.config=root/"client.json";write_json(cls.config,cls.values)
        run("openssl","req","-x509","-newkey","rsa:2048","-nodes","-days","1",
            "-keyout",str(root/"smtp-key.pem"),"-out",str(root/"smtp-ca.pem"),
            "-subj","/CN=localhost","-addext","subjectAltName=DNS:localhost,IP:127.0.0.1")
        cls.primary=Mail(str(root/"smtp-ca.pem"),str(root/"smtp-key.pem"))
        cls.alternate=Mail(str(root/"smtp-ca.pem"),str(root/"smtp-key.pem"))
        (root/"smtp-password").write_text("fixture-token");os.chmod(root/"smtp-password",0o600)
        identity=pwd.getpwnam("ritmo-receiver")
        archive=Path("/srv/ritmo-recovery");archive.mkdir(mode=0o700);os.chown(archive,identity.pw_uid,identity.pw_gid)
        wal=archive/"wal";wal.mkdir(mode=0o700);os.chown(wal,identity.pw_uid,identity.pw_gid)
        control=Path("/var/lib/ritmo-receiver");control.mkdir(mode=0o750);os.chown(control,0,identity.pw_gid)
        for name in ("writer.lock","admin.lock"):
            (control/name).touch();os.chmod(control/name,0o640);os.chown(control/name,0,identity.pw_gid)
        passfile=control/"pgpass";passfile.write_text("127.0.0.1:5999:*:ritmo_wal_receiver:fixture-only")
        passfile.chmod(0o600);os.chown(passfile,identity.pw_uid,identity.pw_gid)
        environment={"PGHOST":"127.0.0.1","PGPORT":"5999","PGDATABASE":"postgres","PGUSER":"ritmo_wal_receiver",
            "PGAPPNAME":"ritmo_wal","PGSSLMODE":"verify-full","PGSSLROOTCERT":str(root/"smtp-ca.pem"),
            "PGPASSFILE":str(passfile),"PGCONNECT_TIMEOUT":"1"}
        write_json(control/"environment.json",environment)
        write_json(root/"receiver.json",{"root":str(archive),"control":str(control),
            "binary":"/usr/lib/postgresql/18/bin/pg_receivewal","environmentFile":str(control/"environment.json")})
        write_json(root/"physical.json",environment)
        Path("/etc/systemd/system/ritmo-wal-receiver.service").write_text(Path("/opt/ritmo/ritmo-wal-receiver.service").read_text())
        cls.smtp={"host":"127.0.0.1","port":cls.primary.server_address[1],"sender":"ops@example.test",
            "recipients":["owner@example.test"],"messageIdDomain":"example.test","username":"fixture",
            "passwordFile":str(root/"smtp-password"),"caFile":str(root/"smtp-ca.pem")}
        cls.other={**cls.smtp,"port":cls.alternate.server_address[1]}
        for name in ("ritmo-monitor.service","ritmo-monitor.timer","ritmo-watchdog.service","ritmo-watchdog.timer"):
            Path("/etc/systemd/system",name).write_text(Path("/opt/ritmo",name).read_text())
        folder=Path("/etc/systemd/system/ritmo-monitor.service.d");folder.mkdir()
        (folder/"fixture.conf").write_text("[Service]\nExecStart=\nExecStart=/usr/bin/python3 /opt/fixture/monitor_job.py\n")
        for folder in ("/srv/ritmo-monitor","/srv/ritmo-watchdog"):
            Path(folder).mkdir(mode=0o700,exist_ok=True)
        write_json(root/"detector-client.json",cls.values)
        write_json(root/"watchdog-smtp.json",cls.other)
        run("systemctl","daemon-reload")
        run("systemd-analyze","verify","/etc/systemd/system/ritmo-watchdog.service","/etc/systemd/system/ritmo-watchdog.timer")
        run("systemctl","start","ritmo-monitor.timer")
        run("systemctl","start","ritmo-monitor.service")

    @classmethod
    def tearDownClass(cls):
        run("systemctl","stop","ritmo-monitor.timer","ritmo-watchdog.timer","ritmo-monitor.service","ritmo-watchdog.service")
        cls.primary.close();cls.alternate.close()
        for path in cls.daemons:
            try: os.kill(int(path.read_text()),15)
            except (OSError,ValueError): pass

    def setUp(self):
        write_json(self.root/"probe-export.json",{"kind":"detector"},replace=True)
        write_json(self.root/"smtp.json",self.smtp,replace=True)
        write_json(self.config,self.values,replace=True)
        write_json(Path("/srv/ritmo-monitor/state.json"),{"version":1,"checked":datetime.now(timezone.utc).isoformat(),
            "reported":{},"consecutive":{}},replace=True)
        self.primary.healthy=True;self.primary.refuse=False;self.primary.tls_enabled=True
        self.alternate.refuse=False
        run("systemctl","start","ritmo-monitor.timer")

    def test_authorized_key_fetches_only_detector_metadata(self):
        report=fetch(self.config)
        self.assertEqual(set(report),{"version","kind","at","checked","schedule","smtp","storagePercent"})
        self.assertEqual(report["kind"],"detector")
        self.assertTrue(report["smtp"])
        self.assertTrue(report["schedule"]["available"])
        self.assertFalse(report["schedule"]["failed"])
        self.assertNotIn("fixture-token",json.dumps(report))

    def test_wrong_key_host_identity_or_role_and_unprotected_config_are_refused(self):
        for change in ({"keyFile":str(self.root/"untrusted-key")},{"knownHostsFile":str(self.root/"unknown_hosts")},
                       {"kind":"receiver"},{"host":"8.8.8.8"},{"timeout":0}):
            (self.root/"unknown_hosts").write_text("[127.0.0.1]:2222 "+(self.root/"untrusted-key.pub").read_text())
            write_json(self.config,{**self.values,**change},replace=True)
            with self.assertRaises((RuntimeError,ValueError)): fetch(self.config)
        write_json(self.config,self.values,replace=True);self.config.chmod(0o644)
        with self.assertRaises(ValueError): fetch(self.config)
        self.config.chmod(0o600)
        link=self.root/"client-link";link.symlink_to(self.config)
        try:
            with self.assertRaises(ValueError): fetch(link)
        finally: link.unlink()

    def test_shell_forwarding_and_additional_privileged_arguments_are_refused(self):
        base=["/usr/bin/ssh","-F","/dev/null","-o","BatchMode=yes","-o","StrictHostKeyChecking=yes",
            "-o","UserKnownHostsFile="+str(self.root/"known_hosts"),"-i",str(self.root/"client-key"),"-p","2222"]
        for command in (["ritmo-probe@127.0.0.1","id"],["ritmo-probe@127.0.0.1","ritmo-probe-v1 extra"],
                        ["-tt","ritmo-probe@127.0.0.1","ritmo-probe-v1"],
                        ["-W","127.0.0.1:2525","ritmo-probe@127.0.0.1"]):
            result=subprocess.run(base+command,capture_output=True,timeout=5)
            self.assertNotEqual(result.returncode,0)
        result=subprocess.run(["runuser","-u","ritmo-probe","--","sudo","-n","/usr/bin/python3",
            "/opt/ritmo/probe_export.py","--worker"],capture_output=True,timeout=5)
        self.assertNotEqual(result.returncode,0)
        result=subprocess.run(["runuser","-u","ritmo-probe","--","sudo","-n","/usr/bin/python3","-c","print(1)"],capture_output=True,timeout=5)
        self.assertNotEqual(result.returncode,0)

    def test_untrusted_payload_limits_and_timeout_fail_without_resolving_incidents(self):
        write_json(self.config,{**self.values,"port":2223,"timeout":1},replace=True)
        for payload in ("overflow","timeout",'{"version":1}',"not json"):
            Path("/opt/fixture/payload-mode").write_text(payload)
            started=time.monotonic()
            with self.assertRaises((RuntimeError,ValueError)): fetch(self.config)
            self.assertLess(time.monotonic()-started,2.5)
        # An otherwise valid report with an extra field is refused at the transport boundary.
        write_json(self.config,self.values,replace=True);report=fetch(self.config)
        write_json(self.config,{**self.values,"port":2223},replace=True)
        Path("/opt/fixture/payload-mode").write_text(json.dumps({**report,"secret":"fixture-only"}))
        with self.assertRaises(ValueError): fetch(self.config)

    def test_receiver_export_filters_events_and_requires_native_watchdog_health(self):
        write_json(self.root/"probe-export.json",{"kind":"receiver"},replace=True)
        write_json(self.config,{**self.values,"kind":"receiver"},replace=True)
        # Package events contain private/internal fields; transport returns only kind and UTC timestamp.
        events=Path("/srv/ritmo-recovery/events");events.mkdir(mode=0o700,exist_ok=True)
        write_json(events/"fixture.json",{"kind":"physical","phase":"started","sequence":1,"run":"fixture",
            "at":datetime.now(timezone.utc).isoformat(),"slot":None,"internal":"fixture-private"})
        report=fetch(self.config)
        self.assertFalse(report["primary"]);self.assertFalse(report["receiver"])
        self.assertTrue(report["catalogValid"])
        self.assertEqual(set(report["incomplete"][0]),{"kind","at"})
        self.assertNotIn("fixture-private",json.dumps(report))
        self.assertFalse(report["watchdog"]["available"])
        sent=[]
        monitor=Monitor(Path("/srv/ritmo-watchdog/receiver-proof.json"),sent.append,interval=1,
                        require_schedule=True,require_watchdog=True)
        monitor.check(datetime.now(timezone.utc),lambda:fetch(self.config))
        time.sleep(1.1);monitor.check(datetime.now(timezone.utc),lambda:fetch(self.config))
        self.assertIn("agenda-watchdog",[item["code"] for item in sent])
        events.joinpath("fixture.json").unlink()

    def test_loss_of_detector_host_is_reported_through_the_alternate_channel(self):
        state=Path("/srv/ritmo-watchdog/loss.json")
        monitor=Monitor(state,SmtpEmail(self.other),interval=1,source="detector")
        pid=int(self.daemons[0].read_text());os.kill(pid,15)
        try:
            monitor.check(datetime.now(timezone.utc),lambda:fetch(self.config))
            time.sleep(1.1);monitor.check(datetime.now(timezone.utc),lambda:fetch(self.config))
            self.assertIn("Ritmo: detector-host / 2",[str(m["Subject"]) for m in self.alternate.messages])
        finally: run("/usr/sbin/sshd","-f","/etc/ssh/fixture-2222.conf")

    def test_parent_deadline_reaps_nested_ssh_client(self):
        write_json(self.config,{**self.values,"port":2223},replace=True)
        Path("/opt/fixture/payload-mode").write_text("timeout")
        with self.assertRaises(RuntimeError):
            bounded_process(["/usr/bin/python3","/opt/ritmo/probe_transport.py",str(self.config)],1)
        leftovers=[]
        for candidate in Path("/proc").iterdir():
            if not candidate.name.isdigit(): continue
            try: command=(candidate/"cmdline").read_bytes()
            except (OSError,ProcessLookupError): continue
            if command.split(bytes([0]),1)[0] == b"/usr/bin/ssh" and str(self.root/"client-key").encode() in command:
                leftovers.append(int(candidate.name))
        for pid in leftovers:
            try: os.kill(pid,9)
            except ProcessLookupError: pass
        self.assertEqual(leftovers,[],"Parent deadline must also terminate the nested SSH client")

    def test_smtp_health_requires_tls_certificate_and_authentication(self):
        self.assertTrue(SmtpEmail(self.smtp).health())
        self.assertFalse(SmtpEmail({k:v for k,v in self.smtp.items() if k!="caFile"}).health())
        (self.root/"smtp-password").write_text("wrong-fixture-only")
        try: self.assertFalse(SmtpEmail(self.smtp).health())
        finally: (self.root/"smtp-password").write_text("fixture-token")
        self.primary.tls_enabled=False
        self.assertFalse(SmtpEmail(self.smtp).health())

    def test_reciprocal_alerts_cross_real_transport_and_independent_smtp_with_retry(self):
        state=Path("/srv/ritmo-watchdog/integration.json");sent_before=len(self.alternate.messages)
        self.primary.healthy=False
        # Main channel is unavailable; alternate still receives the detector-channel alert.
        def fresh():
            run("systemctl","start","ritmo-monitor.service")
            return fetch(self.config)
        monitor=Monitor(state,SmtpEmail(self.other),interval=1,source="detector")
        monitor.check(datetime.now(timezone.utc),fresh)
        time.sleep(1.1)
        monitor.check(datetime.now(timezone.utc),fresh)
        subjects=[str(m["Subject"]) for m in self.alternate.messages[sent_before:]]
        self.assertIn("Ritmo: smtp-channel / 2",subjects)
        self.assertIn("condition=smtp-channel\n",str(self.alternate.messages[-1].get_content()).replace("\r\n","\n"))
        count=len(self.alternate.messages)
        time.sleep(1.1);Monitor(state,SmtpEmail(self.other),interval=1,source="detector").check(datetime.now(timezone.utc),fresh)
        self.assertEqual(len(self.alternate.messages),count)
        self.primary.healthy=True;self.alternate.refuse=True
        time.sleep(1.1)
        with self.assertRaises(OSError): monitor.check(datetime.now(timezone.utc),fresh)
        self.alternate.refuse=False
        time.sleep(1.1);monitor.check(datetime.now(timezone.utc),fresh)
        self.assertIn("Ritmo: smtp-channel / 0",[str(m["Subject"]) for m in self.alternate.messages])
        # Native watchdog command uses the production service, wrappers and schedule evidence.
        run("systemctl","start","ritmo-watchdog.timer");run("systemctl","start","ritmo-watchdog.service")
        proof=json.loads(run("python3","/opt/ritmo/schedule.py","health","--job","watchdog").stdout)
        self.assertEqual(proof,{"available":True,"failed":False})
        run("systemctl","stop","ritmo-watchdog.timer")
        proof=json.loads(run("python3","/opt/ritmo/schedule.py","health","--job","watchdog").stdout)
        self.assertFalse(proof["available"])

if __name__=="__main__": unittest.main()
