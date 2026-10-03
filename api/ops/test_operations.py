import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from operations import Operations, digest, write_json

class BackupCycle(unittest.TestCase):
    def test_missed_local_schedule_runs_once_and_failed_dump_preserves_valid_base(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            calls = []
            def process(args):
                calls.append(args[0])
                if args[0] == "physical":
                    base = Path(args[1]); base.mkdir(parents=True)
                    (base / "backup_manifest").write_text('{"System-Identifier":123,"WAL-Ranges":[{"Timeline":1,"Start-LSN":"0/1000028","End-LSN":"0/1000100"}]}')
                    return ""
                if args[0] == "control": return "Bytes per WAL segment: 16777216"
                if args[0] == "logical": raise RuntimeError("fixture external dump failure")
                return ""
            ops = Operations(root, process)
            self.assertFalse(ops.tick(datetime(2026,10,2,5,59,tzinfo=timezone.utc)))
            self.assertTrue(ops.tick(datetime(2026,10,2,7,0,tzinfo=timezone.utc)))
            self.assertFalse(Operations(root, process).tick(datetime(2026,10,2,8,0,tzinfo=timezone.utc)))
            status = ops.status()
            self.assertEqual(status["physical"], "2026-10-02T07:00:00+00:00")
            self.assertIsNone(status["logical"])
            self.assertEqual(status["failures"][0]["kind"], "logical")
            self.assertEqual(calls.count("physical"), 1)
            self.assertEqual(calls.count("logical"), 1)

class Retention(unittest.TestCase):
    def test_thirty_day_anchor_keeps_required_wal_and_failed_new_base_cannot_trim_it(self):
        import uuid
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); ops=Operations(root, lambda args: "")
            write_json(root / "cluster.json", {"systemIdentifier":"123"})
            packages=[]
            for day, start in ((1,"0/1000028"),(10,"0/2000028"),(20,"0/3000028")):
                package=root / "bases" / uuid.uuid4().hex; base=package / "base"; base.mkdir(parents=True)
                ranges=[{"Timeline":1,"Start-LSN":start,"End-LSN":start[:-2]+"FF"}]
                write_json(base / "backup_manifest", {"WAL-Ranges":ranges,"System-Identifier":123})
                write_json(package / "inventory.json", {"version":1,"kind":"physical","started":f"2026-08-{day:02}T06:00:00+00:00","completed":f"2026-08-{day:02}T07:00:00+00:00","systemIdentifier":"123","ranges":ranges,"manifestHash":digest(base / "backup_manifest")})
                packages.append(package)
            # Native tool is the external record/CRC validator; fixture files only model operational storage.
            for number in range(1,5):
                name=f"0000000100000000{number:08X}"
                (root / "wal" / name).write_bytes(b"fixture")
            (root / "wal" / "000000010000000000000005.partial").write_bytes(b"fixture")
            orphan=root / "bases" / uuid.uuid4().hex; orphan.mkdir()
            plan=ops.prune(datetime(2026,9,15,tzinfo=timezone.utc), apply=False)
            self.assertEqual(plan["bases"], [packages[0].name])
            self.assertEqual(plan["wal"], ["000000010000000000000001"])
            self.assertTrue(packages[0].exists())
            ops.prune(datetime(2026,9,15,tzinfo=timezone.utc), apply=True)
            self.assertFalse(packages[0].exists());self.assertTrue(packages[1].exists());self.assertTrue(orphan.exists())
            self.assertTrue((root / "wal" / "000000010000000000000005.partial").exists())
            # A gap or changed published manifest refuses every deletion.
            (root / "wal" / "000000010000000000000003").unlink()
            with self.assertRaises(ValueError): ops.prune(datetime(2026,10,15,tzinfo=timezone.utc), apply=True)
            self.assertTrue(packages[1].exists())
            (packages[1] / "base" / "backup_manifest").write_text("corrupt")
            with self.assertRaises(ValueError): ops.prune(datetime(2026,10,15,tzinfo=timezone.utc), apply=True)
            self.assertTrue(packages[2].exists())

class Alerts(unittest.TestCase):
    def test_external_loss_thresholds_deduplication_restart_escalation_resolution_and_mail_retry(self):
        from operations import Monitor
        from datetime import timedelta
        with tempfile.TemporaryDirectory() as directory:
            sent=[]; now=datetime(2026,10,2,12,tzinfo=timezone.utc)
            report={"at":now.isoformat(),"primary":True,"receiver":True,"physical":now.isoformat(),"logical":now.isoformat(),"failures":[],"incomplete":[],"storagePercent":20,"catalogValid":True}
            def fetch(): return {**report,"at":now.isoformat()}
            def mail(event): sent.append(event)
            state=Path(directory) / "monitor.json"
            monitor=Monitor(state, mail)
            def lost(): raise TimeoutError("host down fixture")
            monitor.check(now,lost); self.assertEqual(sent,[])
            monitor.check(now+timedelta(seconds=30),lost); self.assertEqual(sent,[])  # same interval cannot count twice
            now+=timedelta(seconds=60);monitor.check(now,lost)
            self.assertEqual([(e["code"],e["level"]) for e in sent],[("receiver-host",2)])
            now+=timedelta(seconds=60);Monitor(state,mail).check(now,lost);self.assertEqual(len(sent),1)
            now+=timedelta(seconds=60);monitor.check(now,fetch)
            self.assertEqual(sent[-1]["level"],0)
            report["storagePercent"]=80
            now+=timedelta(seconds=60);monitor.check(now,fetch);self.assertEqual(sent[-1]["code"],"storage");self.assertEqual(sent[-1]["level"],1)
            report["storagePercent"]=90
            now+=timedelta(seconds=60);monitor.check(now,fetch);self.assertEqual(sent[-1]["level"],2)
            report["storagePercent"]=85
            now+=timedelta(seconds=60);monitor.check(now,fetch);self.assertEqual(len(sent),4)  # no mail on de-escalation
            report["storagePercent"]=20;report["failures"]=[{"kind":"logical","id":"fixture-event"}]
            now+=timedelta(seconds=60);monitor.check(now,fetch)
            self.assertEqual({e["code"] for e in sent[-2:]},{"storage","execution-logical"})
            report["failures"]=[]
            now+=timedelta(hours=26);monitor.check(now,fetch)
            self.assertEqual({e["code"] for e in sent[-3:]},{"backup-physical","backup-logical","execution-logical"})
            report["physical"]=now.isoformat();report["logical"]=now.isoformat()
            def fail_mail(event): raise OSError("fixture smtp unavailable")
            now+=timedelta(seconds=60)
            with self.assertRaises(OSError): Monitor(state,fail_mail).check(now,fetch)
            count=len(sent);now+=timedelta(seconds=60);Monitor(state,mail).check(now,fetch)
            self.assertEqual(len(sent),count+2);self.assertEqual(sent[-1]["level"],0)
            self.assertFalse(any("host down" in str(e) or "smtp unavailable" in str(e) for e in sent))

class FrozenChain(unittest.TestCase):
    def test_frozen_inventory_rejects_mutation_and_live_receiver_before_restore(self):
        import uuid
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory) / "archive"; live=False; restored=[]
            def process(args):
                if args[0]=="stopped" and live: raise RuntimeError("fixture receiver running")
                if args[0]=="select": return "0/1000200 1"
                if args[0]=="restore": restored.append(args)
                return ""
            ops=Operations(root,process)
            write_json(root / "cluster.json",{"systemIdentifier":"123"})
            package=root / "bases" / uuid.uuid4().hex;base=package / "base";base.mkdir(parents=True)
            ranges=[{"Timeline":1,"Start-LSN":"0/1000028","End-LSN":"0/1000100"}]
            write_json(base / "backup_manifest",{"System-Identifier":123,"WAL-Ranges":ranges})
            write_json(package / "inventory.json",{"version":1,"kind":"physical","started":"2026-10-02T06:00:00+00:00","completed":"2026-10-02T07:00:00+00:00","systemIdentifier":"123","ranges":ranges,"manifestHash":digest(base / "backup_manifest")})
            tail=root / "wal" / "000000010000000000000001.partial";tail.write_bytes(b"fixture synchronous WAL")
            live=True
            with self.assertRaises(RuntimeError): ops.freeze(datetime(2026,10,2,8,tzinfo=timezone.utc))
            live=False;frozen=ops.freeze(datetime(2026,10,2,8,tzinfo=timezone.utc))
            target=Path(directory) / "new-pgdata"
            ops.restore(frozen,target,quarantine=True)
            self.assertEqual(restored[-1][-2:], ["0/1000200","1"])
            with self.assertRaises(ValueError): ops.restore(frozen,target,quarantine=False)
            (frozen / "wal" / tail.name).write_bytes(b"corrupt")
            with self.assertRaises(ValueError): ops.restore(frozen,target,quarantine=True)
            self.assertEqual(len(restored),1)
            self.assertEqual(tail.read_bytes(),b"fixture synchronous WAL")

class Drills(unittest.TestCase):
    def test_failed_drill_does_not_satisfy_monthly_or_new_major_gate(self):
        with tempfile.TemporaryDirectory() as directory:
            failed=False
            def process(args):
                if failed: raise RuntimeError("fixture failed public API verification")
                return ""
            ops=Operations(Path(directory),process)
            october=datetime(2026,10,2,12,tzinfo=timezone.utc)
            self.assertTrue(ops.drill_due(october,1))
            ops.drill(october,1)
            self.assertFalse(Operations(Path(directory),process).drill_due(october,1))
            self.assertTrue(ops.drill_due(october,2))
            failed=True;ops.drill(october,2)
            self.assertTrue(ops.drill_due(october,2))
            self.assertFalse(ops.drill_due(datetime(2026,11,1,tzinfo=timezone.utc),1))
            self.assertTrue(ops.drill_due(datetime(2026,11,1,6,tzinfo=timezone.utc),1))
            successes=[e for e in ops.events() if e["kind"]=="drill" and e["phase"]=="succeeded"]
            self.assertEqual(len(successes),1)
            self.assertEqual(successes[0]["scope"],"local")
            self.assertGreaterEqual(successes[0]["elapsedSeconds"],0)

class ProcessBoundary(unittest.TestCase):
    def test_timed_out_external_process_is_not_reported_as_success(self):
        from operations import run_process
        import sys
        with self.assertRaises(RuntimeError): run_process([sys.executable,"-c","import time;time.sleep(30)"],timeout=0.2)
        self.assertEqual(run_process([sys.executable,"-c","print('probe-ok')"],timeout=5).strip(),"probe-ok")

class ProbeContracts(unittest.TestCase):
    def test_malformed_and_stale_probe_cannot_resolve_alerts_or_reset_failure_counter(self):
        from operations import Monitor
        from datetime import timedelta
        with tempfile.TemporaryDirectory() as directory:
            now=datetime(2026,10,2,12,tzinfo=timezone.utc);sent=[]
            report={"at":now.isoformat(),"primary":True,"receiver":True,"physical":now.isoformat(),"logical":now.isoformat(),"failures":[],"incomplete":[{"kind":"logical","at":"bad"}],"storagePercent":20,"catalogValid":True}
            state=Path(directory) / "monitor.json";monitor=Monitor(state,sent.append)
            monitor.check(now,lambda:report)
            now+=timedelta(seconds=60);report["at"]=now.isoformat();monitor.check(now,lambda:report)
            self.assertEqual([e["code"] for e in sent],["receiver-host"])
            now+=timedelta(seconds=60);report["incomplete"]=[];report["at"]=(now-timedelta(minutes=5)).isoformat();monitor.check(now,lambda:report)
            self.assertEqual(len(sent),1)
            now+=timedelta(seconds=60);report["at"]=now.isoformat();report["primary"]=False;report["receiver"]=False;monitor.check(now,lambda:report)
            now+=timedelta(seconds=60);report["at"]=now.isoformat();monitor.check(now,lambda:report)
            self.assertEqual({e["code"] for e in sent[-2:]},{"primary","receiver"})
            report["primary"]=True;report["receiver"]=True
            now+=timedelta(seconds=60);report["at"]=now.isoformat();monitor.check(now,lambda:report)
            self.assertEqual([e["level"] for e in sent[-2:]],[0,0])

class BackupIdentity(unittest.TestCase):
    def test_logical_backup_from_another_cluster_is_not_published_and_own_dump_survives_base_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);cluster="999"
            def process(args):
                if args[0]=="physical": raise TypeError("fixture invalid libpq environment")
                if args[0]=="cluster": return cluster
                if args[0]=="logical":
                    archive=Path(args[1]);archive.write_bytes(b"abc")
                    archive.with_suffix(".dump.sha256").write_text("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
                return ""
            ops=Operations(root,process);write_json(root / "cluster.json",{"systemIdentifier":"123"})
            now=datetime(2026,10,2,12,tzinfo=timezone.utc);ops.backup(now)
            self.assertIsNone(ops.status()["logical"])
            self.assertEqual({e["kind"] for e in ops.status()["failures"]},{"physical","logical"})
            cluster="123";now=datetime(2026,10,2,14,tzinfo=timezone.utc);ops.backup(now)
            self.assertEqual(ops.status()["logical"],"2026-10-02T14:00:00+00:00")
            self.assertEqual([e["kind"] for e in ops.status()["failures"]],["physical"])

class ScheduleAlerts(unittest.TestCase):
    def test_missing_agenda_requires_two_probes_but_job_failure_is_immediate_and_retained(self):
        from operations import Monitor
        from datetime import timedelta
        with tempfile.TemporaryDirectory() as directory:
            now=datetime(2026,10,3,12,tzinfo=timezone.utc);sent=[]
            report={'primary':True,'receiver':True,'physical':now.isoformat(),'logical':now.isoformat(),
                'failures':[],'incomplete':[],'storagePercent':20,'catalogValid':True,
                'schedule':{'available':False,'failed':False}}
            monitor=Monitor(Path(directory)/'monitor.json',sent.append,require_schedule=True)
            def fetch(): return {**report,'at':now.isoformat()}
            monitor.check(now,fetch);self.assertEqual(sent,[])
            now+=timedelta(seconds=60);monitor.check(now,fetch)
            self.assertEqual([(e['code'],e['level']) for e in sent],[('agenda-backup',2)])
            report['schedule']={'available':True,'failed':True}
            now+=timedelta(seconds=60);monitor.check(now,fetch)
            self.assertEqual({(e['code'],e['level']) for e in sent[-2:]},{('agenda-backup',0),('job-backup',2)})
            now+=timedelta(seconds=60);monitor.check(now,fetch);self.assertEqual(len(sent),3)
            # An omitted or malformed schedule must not resolve a known execution failure.
            report.pop('schedule')
            now+=timedelta(seconds=60);monitor.check(now,fetch);self.assertEqual(len(sent),3)
            report['schedule']={'available':'yes','failed':False}
            now+=timedelta(seconds=60);monitor.check(now,fetch)
            self.assertEqual(sent[-1]['code'],'receiver-host')
            report['schedule']={'available':True,'failed':False}
            now+=timedelta(seconds=60);monitor.check(now,fetch)
            self.assertEqual({(e['code'],e['level']) for e in sent[-2:]},{('receiver-host',0),('job-backup',0)})
if __name__ == "__main__": unittest.main()
