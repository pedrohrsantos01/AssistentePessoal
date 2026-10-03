"""Finite operational jobs. No connection or scheduler starts on import."""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import uuid
import time
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, TYPE_CHECKING

if TYPE_CHECKING:
    from receiver import Receiver
from zoneinfo import ZoneInfo

UTC = timezone.utc
SEGMENT = 16 * 1024 * 1024
NAME = re.compile(r"[0-9a-f]{32}")
WAL = re.compile(r"([0-9A-F]{8})([0-9A-F]{8})([0-9A-F]{8})(\.partial)?")
HISTORY = re.compile(r"[0-9A-F]{8}\.history")
Process = Callable[[list[str]], str]


def stamp(now: datetime) -> str:
    if now.tzinfo is None: raise ValueError("clock_requires_timezone")
    return now.astimezone(UTC).isoformat()


def instant(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    stamp(parsed)
    return parsed.astimezone(UTC)


def sync_dir(path: Path) -> None:
    # Deployment requires POSIX directory fsync. Windows is a fixture harness only.
    if os.name != "nt":
        fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
        try: os.fsync(fd)
        finally: os.close(fd)


def write_json(path: Path, value: dict, replace: bool = False) -> None:
    temporary = path.parent / (".publish-" + uuid.uuid4().hex)
    try:
        with temporary.open("x", encoding="utf-8") as stream:
            os.chmod(temporary, 0o600)
            json.dump(value, stream, sort_keys=True)
            stream.flush(); os.fsync(stream.fileno())
        if replace: os.replace(temporary, path)
        else: os.link(temporary, path)
        sync_dir(path.parent)
    finally:
        temporary.unlink(missing_ok=True)


def read_json(path: Path) -> dict:
    if path.is_symlink(): raise ValueError("symlink_refused")
    with path.open(encoding="utf-8") as stream: value = json.load(stream)
    if not isinstance(value, dict): raise ValueError("invalid_inventory")
    return value


def digest(path: Path) -> str:
    if path.is_symlink() or not path.is_file(): raise ValueError("file_required")
    with path.open("rb") as stream: return hashlib.file_digest(stream, "sha256").hexdigest()


def lsn(value: str) -> int:
    if not re.fullmatch(r"[0-9A-F]{1,8}/[0-9A-F]{1,8}", value): raise ValueError("invalid_lsn")
    high, low = value.split("/"); return (int(high, 16) << 32) + int(low, 16)


def segment_number(name: str) -> int:
    match = WAL.fullmatch(name)
    if not match: raise ValueError("invalid_wal_name")
    if int(match[3],16)>=256: raise ValueError("invalid_segment_number")
    return int(match[2], 16) * 256 + int(match[3], 16)


class Operations:
    def __init__(self, root: Path, process: Process, clock: Callable[[], datetime] | None = None):
        self.root = root.absolute()
        if any(p.is_symlink() for p in [self.root, *self.root.parents]): raise ValueError("symlink_refused")
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        if os.name!="nt" and self.root.stat().st_mode & 0o077: raise ValueError("root_requires_private_directory")
        self.process = process; self.clock = clock
        for name in ("bases", "logical", "wal", "events", "frozen"):
            path = self.root / name
            if path.is_symlink(): raise ValueError("symlink_refused")
            path.mkdir(exist_ok=True, mode=0o700)
        sync_dir(self.root);sync_dir(self.root.parent)

    @contextmanager
    def locked(self):
        lock = self.root / ".lock"
        lock.mkdir(mode=0o700)  # Occupied/stale lock fails closed; no concurrent destructive job.
        try: yield
        finally: lock.rmdir()

    def event(self, kind: str, phase: str, now: datetime, run: str, slot: str | None = None, extra: dict | None = None) -> None:
        identifier = uuid.uuid4().hex
        sequence = max((e.get("sequence",0) for e in self.events()),default=0)+1
        write_json(self.root / "events" / (identifier + ".json"),
                   {"version": 1, "id": identifier, "sequence":sequence, "run": run, "kind": kind, "phase": phase, "at": stamp(now), "slot": slot, **(extra or {})})

    def events(self) -> list[dict]:
        return [read_json(p) for p in (self.root / "events").glob("*.json")]

    def tick(self, now: datetime) -> bool:
        local = now.astimezone(ZoneInfo("America/Sao_Paulo"))
        if local.hour < 3: return False
        slot = local.date().isoformat()
        with self.locked():
            if any(e["slot"] == slot and e["kind"] == "cycle" for e in self.events()): return False
            run = uuid.uuid4().hex; self.event("cycle", "started", now, run, slot)
            self._backup(now, run, slot)
        return True

    def backup(self, now: datetime) -> None:
        with self.locked(): self._backup(now, uuid.uuid4().hex, None)

    def _backup(self, now: datetime, run: str, slot: str | None) -> None:
        for kind in ("physical", "logical"):
            began=self.clock() if self.clock else now
            self.event(kind, "started", began, run, slot)
            package = self.root / ("bases" if kind == "physical" else "logical") / uuid.uuid4().hex
            try:
                package.mkdir(mode=0o700)
                if kind == "physical":
                    base = package / "base"
                    self.process(["physical", str(base)]); self.process(["verify", str(base)])
                    manifest = read_json(base / "backup_manifest")
                    ranges = manifest["WAL-Ranges"]
                    if len(ranges) != 1 or lsn(ranges[0]["Start-LSN"]) >= lsn(ranges[0]["End-LSN"]): raise ValueError("unsupported_base_ranges")
                    control = self.process(["control", str(base)])
                    if not re.search(r"Bytes per WAL segment:\s+16777216\b", control): raise ValueError("unsupported_segment_size")
                    cluster = str(manifest["System-Identifier"])
                    binding = self.root / "cluster.json"
                    if binding.exists():
                        if read_json(binding)["systemIdentifier"] != cluster: raise ValueError("cluster_mismatch")
                    else: write_json(binding, {"version": 1, "systemIdentifier": cluster})
                    metadata = {"systemIdentifier": cluster, "ranges": ranges, "manifestHash": digest(base / "backup_manifest")}
                else:
                    archive = package / "archive.dump"
                    before_cluster=self.process(["cluster"]).strip()
                    self.process(["logical", str(archive)])
                    self.process(["list", str(archive)])
                    cluster=self.process(["cluster"]).strip()
                    if not cluster.isdigit() or before_cluster!=cluster: raise ValueError("invalid_or_changed_cluster")
                    binding=self.root / "cluster.json"
                    if binding.exists():
                        if read_json(binding)["systemIdentifier"]!=cluster: raise ValueError("cluster_mismatch")
                    else: write_json(binding,{"version":1,"systemIdentifier":cluster})
                    metadata = {"archiveHash": digest(archive),"systemIdentifier":cluster}
                    if (package / "archive.dump.sha256").read_text().strip() != metadata["archiveHash"]: raise ValueError("checksum_mismatch")
                if kind=="logical":
                    for durable in (archive,package / "archive.dump.sha256"):
                        with durable.open("r+b") as stream: os.fsync(stream.fileno())
                    sync_dir(package)
                ended = self.clock() if self.clock else now
                write_json(package / "inventory.json", {"version": 1, "kind": kind, "started": stamp(began), "completed": stamp(ended), **metadata})
                self.event(kind, "succeeded", ended, run, slot)
            except (OSError, ValueError, KeyError, TypeError, RuntimeError, subprocess.SubprocessError):
                # No private process output or exception text enters metadata/email.
                self.event(kind, "failed", self.clock() if self.clock else now, run, slot)
        self.event("cycle", "finished", self.clock() if self.clock else now, run, slot)

    def packages(self, kind: str, verify: bool = False) -> list[tuple[Path, dict]]:
        found = []
        for package in (self.root / ("bases" if kind == "physical" else "logical")).iterdir():
            if package.is_symlink() or not NAME.fullmatch(package.name): raise ValueError("invalid_package")
            if not (package / "inventory.json").exists(): continue  # unpublished failure/orphan is preserved
            value = read_json(package / "inventory.json")
            if value["version"] != 1 or value["kind"] != kind: raise ValueError("invalid_inventory")
            if kind == "physical":
                base = package / "base"
                if value["systemIdentifier"] != read_json(self.root / "cluster.json")["systemIdentifier"]: raise ValueError("cluster_mismatch")
                if digest(base / "backup_manifest") != value["manifestHash"]: raise ValueError("manifest_changed")
                if read_json(base / "backup_manifest")["WAL-Ranges"] != value["ranges"]: raise ValueError("ranges_changed")
                if verify: self.process(["verify", str(base)])
            else:
                if value["systemIdentifier"]!=read_json(self.root / "cluster.json")["systemIdentifier"]: raise ValueError("cluster_mismatch")
                if verify and digest(package / "archive.dump") != value["archiveHash"]: raise ValueError("dump_changed")
            instant(value["started"]);instant(value["completed"])
            if instant(value["started"])>instant(value["completed"]): raise ValueError("invalid_backup_clock")
            found.append((package, value))
        return sorted(found, key=lambda item: instant(item[1]["started"]))

    def status(self) -> dict:
        result = {"physical": None, "logical": None, "failures": [], "incomplete": []}
        events = self.events()
        for kind in ("physical", "logical", "drill"):
            if kind != "drill":
                packages = self.packages(kind)
                if packages: result[kind] = max(m["completed"] for _, m in packages)
            runs = [e for e in events if e["kind"] == kind]
            starts = [e for e in runs if e["phase"] == "started"]
            if starts:
                start = max(starts, key=lambda e: e["sequence"])
                terminal = [e for e in runs if e["run"] == start["run"] and e["phase"] in ("succeeded", "failed")]
                if not terminal: result["incomplete"].append(start)
                elif terminal[0]["phase"] == "failed": result["failures"].append(terminal[0])
        return result

    def prune(self, now: datetime, apply: bool = False) -> dict:
        with self.locked():
            cutoff = now.astimezone(UTC) - timedelta(days=30)
            keep = {}; remove = {}
            for kind in ("physical", "logical"):
                items = self.packages(kind, verify=True)
                if kind == "physical" and not items: raise ValueError("base_required")
                anchors = [i for i, (_, m) in enumerate(items) if instant(m["completed"]) <= cutoff]
                anchor = max(anchors) if anchors else 0
                keep[kind] = items[anchor:]; remove[kind] = items[:anchor]
            first = min(lsn(m["ranges"][0]["Start-LSN"]) for _, m in keep["physical"]) // SEGMENT
            files = list((self.root / "wal").iterdir())
            if any(f.is_symlink() or not (WAL.fullmatch(f.name) or HISTORY.fullmatch(f.name)) for f in files): raise ValueError("invalid_wal_inventory")
            segments = [f for f in files if WAL.fullmatch(f.name)]
            numbers = {segment_number(f.name) for f in segments}
            if not numbers or not any(f.name.endswith(".partial") for f in segments): raise ValueError("tail_required")
            relevant=sorted(n for n in numbers if n>=first)
            if not relevant or any(n!=first+i for i,n in enumerate(relevant)): raise ValueError("wal_gap")
            # Native process verifies cluster, histories and CRCs of immutable closed segments.
            self.process(["check-chain", str(keep["physical"][0][0] / "base"), str(self.root / "wal")])
            old_wal = sorted(f.name for f in segments if not f.name.endswith(".partial") and segment_number(f.name) < first)
            plan = {"bases": [p.name for p, _ in remove["physical"]], "logical": [p.name for p, _ in remove["logical"]], "wal": old_wal,
                    "windowFrom": stamp(max(cutoff, instant(keep["physical"][0][1]["completed"])))}
            targets = [p for kind in remove for p, _ in remove[kind]] + [self.root / "wal" / n for n in old_wal]
            for target in targets:
                if self.root.resolve() not in target.resolve().parents or target.is_symlink(): raise ValueError("unsafe_delete")
                if target.is_dir() and any(p.is_symlink() for p in target.rglob("*")): raise ValueError("symlink_refused")
            if apply:
                # Remove catalogue publication first; interrupted removal leaves an unpublished orphan.
                for kind in remove:
                    for package, _ in remove[kind]:
                        (package / "inventory.json").unlink(); sync_dir(package)
                        shutil.rmtree(package); sync_dir(package.parent)
                for name in old_wal: (self.root / "wal" / name).unlink()
                sync_dir(self.root / "wal")
            return plan


    def freeze(self, now: datetime, before: datetime | None = None) -> Path:
        with self.locked():
            self.process(["stopped"])
            items = self.packages("physical", verify=True)
            if before is not None: items = [(p,m) for p,m in items if instant(m["completed"])<=before]
            if not items: raise ValueError("base_required")
            package,metadata = items[-1]
            source = package / "base"
            sources = [source, self.root / "wal"]
            if any(p.is_symlink() for directory in sources for p in directory.rglob("*")): raise ValueError("symlink_refused")
            frozen = self.root / "frozen" / uuid.uuid4().hex; frozen.mkdir(mode=0o700)
            shutil.copytree(source, frozen / "base", symlinks=True)
            shutil.copytree(self.root / "wal", frozen / "wal", symlinks=True)
            selected = self.process(["select", str(frozen / "base"), str(frozen / "wal")]).split()
            if len(selected)!=2 or not selected[1].isdigit(): raise ValueError("invalid_target")
            if lsn(selected[0])<lsn(metadata["ranges"][0]["End-LSN"]) or int(selected[1])<metadata["ranges"][0]["Timeline"]: raise ValueError("target_before_base")
            self.process(["stopped"])
            files = {}
            for path in frozen.rglob("*"):
                if path.is_symlink(): raise ValueError("symlink_refused")
                if path.is_file():
                    files[path.relative_to(frozen).as_posix()] = digest(path)
                    with path.open("r+b") as stream: os.fsync(stream.fileno())
            for path in sorted((p for p in frozen.rglob("*") if p.is_dir()),key=lambda p:len(p.parts),reverse=True): sync_dir(path)
            write_json(frozen / "inventory.json", {"version":1,"created":stamp(now),"baseId":package.name,
                "systemIdentifier":metadata["systemIdentifier"],"targetLsn":selected[0],"timeline":int(selected[1]),"files":files})
            sync_dir(frozen);sync_dir(frozen.parent)
            return frozen

    def restore(self, frozen: Path, destination: Path, quarantine: bool = False) -> None:
        if not quarantine: raise ValueError("recovery_requires_quarantine")
        with self.locked():
            if self.root.resolve() / "frozen" != frozen.resolve().parent or not NAME.fullmatch(frozen.name): raise ValueError("invalid_frozen_path")
            inventory = read_json(frozen / "inventory.json")
            if inventory["version"]!=1 or inventory["systemIdentifier"]!=read_json(self.root / "cluster.json")["systemIdentifier"]: raise ValueError("cluster_mismatch")
            observed = {p.relative_to(frozen).as_posix():digest(p) for p in frozen.rglob("*") if p.is_file() and p!=frozen / "inventory.json"}
            if any(p.is_symlink() for p in frozen.rglob("*")) or observed!=inventory["files"]: raise ValueError("frozen_inventory_changed")
            self.process(["verify", str(frozen / "base")])
            selected = self.process(["select", str(frozen / "base"), str(frozen / "wal")]).split()
            if selected!=[inventory["targetLsn"],str(inventory["timeline"])]: raise ValueError("frozen_target_changed")
            if destination.exists() or destination.is_symlink() or self.root.resolve() in destination.resolve().parents: raise ValueError("destination_exists_or_nested")
            self.process(["restore", str(frozen / "base"), str(frozen / "wal"), str(destination.absolute()),inventory["targetLsn"],str(inventory["timeline"])])


    def drill_due(self, now: datetime, major: int) -> bool:
        if major<0: raise ValueError("invalid_major")
        successes=[e for e in self.events() if e["kind"]=="drill" and e["phase"]=="succeeded" and e.get("scope")=="local"]
        month=now.astimezone(ZoneInfo("America/Sao_Paulo")).strftime("%Y-%m")
        monthly=any(instant(e["at"]).astimezone(ZoneInfo("America/Sao_Paulo")).strftime("%Y-%m")==month for e in successes)
        release=any(e["major"]==major for e in successes)
        return not (monthly and release)

    def drill(self, now: datetime, major: int) -> bool:
        if major<0: raise ValueError("invalid_major")
        with self.locked():
            run=uuid.uuid4().hex;self.event("drill","started",now,run,extra={"scope":"local","major":major})
            started=time.monotonic();success=True
            try: self.process(["drill"])
            except (OSError,ValueError,TypeError,RuntimeError,subprocess.SubprocessError): success=False
            elapsed=time.monotonic()-started
            self.event("drill","succeeded" if success else "failed",self.clock() if self.clock else now,run,
                extra={"scope":"local","major":major,"elapsedSeconds":elapsed})
            return success

    def probe(self, now: datetime, include_schedule: bool = False) -> dict:
        try:
            status=self.status();valid=True
        except (OSError,ValueError,KeyError,TypeError,RuntimeError):
            status={"physical":None,"logical":None,"failures":[],"incomplete":[]};valid=False
        try: health=json.loads(self.process(["health"]))
        except (OSError,ValueError,RuntimeError,subprocess.SubprocessError): health={"primary":False,"receiver":False}
        disk=shutil.disk_usage(self.root)
        schedule = {}
        if include_schedule:
            try: evidence = json.loads(self.process(["schedule"]))
            except (OSError,ValueError,KeyError,TypeError,RuntimeError,subprocess.SubprocessError): evidence = {"available":False,"failed":False}
            schedule = {"schedule": evidence}
        return {**status,**schedule,"at":stamp(now),"primary":health["primary"],"receiver":health["receiver"],"catalogValid":valid,
                "storagePercent":100*(disk.total-disk.free)/disk.total}


class Monitor:
    def __init__(self, state: Path, send: Callable[[dict], None], interval: int = 60,
                 failures: int = 2, max_age_hours: int = 26, warn: int = 80, critical: int = 90, require_schedule: bool = False):
        if interval < 1 or failures < 1 or max_age_hours < 1 or not 0 < warn < critical <= 100: raise ValueError("invalid_limits")
        self.path=state.absolute(); self.send=send; self.interval=interval; self.failures=failures
        self.max_age=timedelta(hours=max_age_hours); self.warn=warn; self.critical=critical; self.require_schedule=require_schedule
        if any(p.is_symlink() for p in [self.path, *self.path.parents]): raise ValueError("symlink_refused")
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)

    def check(self, now: datetime, fetch: Callable[[], dict]) -> list[dict]:
        lock=self.path.with_suffix(".lock");lock.mkdir(mode=0o700)
        try: return self._check(now, fetch)
        finally: lock.rmdir()

    def _check(self, now: datetime, fetch: Callable[[], dict]) -> list[dict]:
        state=read_json(self.path) if self.path.exists() else {"version":1,"reported":{},"consecutive":{}}
        if "checked" in state and now-instant(state["checked"]) < timedelta(seconds=self.interval): return []
        desired={}; counts=state["consecutive"]
        def available(code: str, healthy: bool):
            counts[code]=0 if healthy else counts.get(code,0)+1
            desired[code]=0 if healthy or counts[code]<self.failures else 2
        try:
            report=fetch()
            age=now-instant(report["at"])
            if age<timedelta(seconds=-self.interval) or age>timedelta(seconds=self.interval*2): raise ValueError("stale_probe")
            if not isinstance(report["primary"],bool) or not isinstance(report["receiver"],bool): raise ValueError("invalid_probe")
            if not 0<=report["storagePercent"]<=100: raise ValueError("invalid_probe")
            # Validate all fields before any condition may be resolved.
            for kind in ("physical","logical"):
                if report[kind] is not None and instant(report[kind])>now+timedelta(seconds=self.interval): raise ValueError("future_backup")
            if type(report["catalogValid"]) is not bool or type(report["storagePercent"]) not in (int,float): raise ValueError("invalid_probe")
            for key in ("failures","incomplete"):
                if not isinstance(report[key],list): raise ValueError("invalid_probe")
                for event in report[key]:
                    if not isinstance(event,dict) or event["kind"] not in ("physical","logical","drill"): raise ValueError("invalid_probe")
                    if key=="incomplete": instant(event["at"])
            schedule=report.get("schedule")
            if self.require_schedule or schedule is not None:
                if not isinstance(schedule,dict) or type(schedule.get("available")) is not bool or type(schedule.get("failed")) is not bool: raise ValueError("invalid_schedule_probe")
            available("receiver-host",True)
            if schedule is not None:
                available("agenda-backup",schedule["available"])
                desired["job-backup"]=2 if schedule["failed"] else 0
            available("primary",report["primary"]);available("receiver",report["receiver"])
            desired["catalog"]=0 if report["catalogValid"] is True else 2
            for kind in ("physical","logical"):
                value=report[kind]
                desired["backup-"+kind]=2 if value is None or now-instant(value)>self.max_age else 0
            for kind in ("physical","logical","drill"):
                incomplete=any(e["kind"]==kind and now-instant(e["at"])>self.max_age for e in report["incomplete"])
                desired["execution-"+kind]=2 if incomplete or any(e["kind"]==kind for e in report["failures"]) else 0
            percent=report["storagePercent"]
            desired["storage"]=2 if percent>=self.critical else (1 if percent>=self.warn else 0)
        except (OSError, ValueError, KeyError, TypeError, RuntimeError, subprocess.SubprocessError):
            desired={}; available("receiver-host",False)  # Unknown health never resolves previous alerts.
        state["checked"]=stamp(now)
        write_json(self.path,state,replace=True)
        sent=[]
        for code,level in desired.items():
            before=state["reported"].get(code,0)
            if level>before or (level==0 and before>0):
                identifier=hashlib.sha256(f"{code}:{before}:{level}:{state.get('transition-'+code,'initial')}".encode()).hexdigest()
                event={"code":code,"level":level,"id":identifier}
                self.send(event)  # Do not acknowledge failed/uncertain SMTP delivery.
                state["transition-"+code]=identifier;sent.append(event)
            # A de-escalation is quiet and does not reset the escalation dedupe until resolution.
            if level>=before or level==0:
                state["reported"][code]=level
                write_json(self.path,state,replace=True)
        return sent


def run_process(args: list[str], timeout: float = 30, env: dict[str,str] | None = None) -> str:
    import signal
    with subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env,
                          start_new_session=os.name!="nt") as child:
        try: output,_=child.communicate(timeout=timeout)
        except BaseException as failure:
            if os.name=="nt": child.kill()
            else: os.killpg(child.pid,signal.SIGTERM)
            try: child.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                if os.name=="nt": child.kill()
                else: os.killpg(child.pid,signal.SIGKILL)
                child.communicate()
            if isinstance(failure,subprocess.TimeoutExpired): raise RuntimeError("operational_process_timeout") from None
            raise
        if child.returncode!=0: raise RuntimeError("operational_process_failed")
        return output.decode("utf-8")


def private_config(path: Path | None) -> dict:
    if path is None: return {}
    if path.is_symlink() or (os.name!="nt" and path.stat().st_mode & 0o077): raise ValueError("config_requires_private_file")
    return read_json(path)


class NativeProcess:
    def __init__(self, physical: dict, logical: dict, receiver_state: str | None, timeout: int = 86400, receiver: Receiver | None = None):
        self.physical={**os.environ,**physical};self.logical={**os.environ,**logical}
        self.receiver_state=receiver_state;self.timeout=timeout;self.receiver=receiver
        if timeout<1: raise ValueError("invalid_timeout")
        self.ops=Path(__file__).resolve().parent

    def __call__(self, args: list[str]) -> str:
        kind,*values=args
        if kind in ("physical","logical"):
            script="physical-base.sh" if kind=="physical" else "backup.sh"
            return run_process(["sh",str(self.ops / script),*values],self.timeout,self.physical if kind=="physical" else self.logical)
        if kind in ("verify","control","list"):
            tool={"verify":"pg_verifybackup","control":"pg_controldata","list":"pg_restore"}[kind]
            return run_process([tool,*( ["--list"] if kind=="list" else []),*values],self.timeout)
        if kind in ("select","check-chain"):
            return run_process(["sh",str(self.ops / "select-wal-target.sh"),*values,*( ["closed"] if kind=="check-chain" else [])],
                self.timeout,{**os.environ,"RITMO_WAL_FROZEN":"true"})
        if kind=="restore":
            return run_process(["sh",str(self.ops / "restore-physical.sh"),*values],self.timeout,
                {**os.environ,"RITMO_RECOVERY_QUARANTINE":"true"})
        if kind=="cluster":
            return run_process(["psql","--no-password","-XAt","-v","ON_ERROR_STOP=1","-c","SELECT system_identifier::text FROM pg_control_system()"],5,self.logical)
        if kind=="stopped":
            state=self.receiver.state() if self.receiver else (run_process([self.receiver_state],5).strip() if self.receiver_state else None)
            if state!="stopped": raise RuntimeError("receiver_not_verified_stopped")
            return ""
        if kind=="schedule":
            from schedule import health
            return json.dumps(health("backup"))
        if kind=="health":
            query="SELECT json_build_object('primary',NOT pg_is_in_recovery(),'receiver',EXISTS(SELECT 1 FROM pg_stat_replication r JOIN pg_replication_slots s ON s.active_pid=r.pid WHERE r.usename='ritmo_wal_receiver' AND r.application_name='ritmo_wal' AND r.state='streaming' AND r.sync_state='sync' AND r.flush_lsn IS NOT NULL AND s.slot_name='ritmo_wal' AND s.slot_type='physical'))"
            try: health=json.loads(run_process(["psql","--no-password","-XAt","-v","ON_ERROR_STOP=1","-c",query],5,self.physical))
            except (ValueError,RuntimeError,OSError): health={"primary":False,"receiver":False}
            try: alive=(self.receiver.state() if self.receiver else (run_process([self.receiver_state],5).strip() if self.receiver_state else None))=="running"
            except (RuntimeError,OSError): alive=False
            health["receiver"]=health["receiver"] and alive
            return json.dumps(health)
        if kind=="drill":
            api=self.ops.parent
            return run_process(["sh",str(api / "gradlew"),"-p",str(api),"check","--rerun-tasks","--no-daemon"],self.timeout)
        raise ValueError("unknown_operational_process")


class SmtpEmail:
    def __init__(self, config: dict): self.config=config
    def __call__(self, event: dict) -> None:
        import smtplib
        import ssl
        from email.message import EmailMessage
        config=self.config
        message=EmailMessage();message["From"]=config["sender"];message["To"]=", ".join(config["recipients"])
        message["Subject"]=f"Ritmo: {event['code']} / {event['level']}"
        message["Message-ID"]=f"<ritmo-{event['id']}@{config['messageIdDomain']}>"
        message.set_content(f"condition={event['code']}\nseverity={event['level']}\nevent={event['id']}\n")
        with smtplib.SMTP(config["host"],config.get("port",587),timeout=10) as smtp:
            smtp.ehlo();smtp.starttls(context=ssl.create_default_context());smtp.ehlo()
            if config.get("username"):
                secret=Path(config["passwordFile"])
                if secret.is_symlink() or (os.name!="nt" and secret.stat().st_mode & 0o077): raise ValueError("smtp_requires_private_secret")
                smtp.login(config["username"],secret.read_text().rstrip("\r\n"))
            if smtp.send_message(message): raise RuntimeError("smtp_recipient_refused")


def main() -> int:
    import argparse
    parser=argparse.ArgumentParser(description="Finite Ritmo backup and monitor jobs; see operations.md")
    parser.add_argument("--root",type=Path)
    parser.add_argument("--physical-env",type=Path);parser.add_argument("--logical-env",type=Path)
    parser.add_argument("--receiver-config",type=Path)
    parser.add_argument("--schedule-job",choices=("backup",))
    parser.add_argument("--receiver-state-command");parser.add_argument("--timeout",type=int,default=86400)
    commands=parser.add_subparsers(dest="command",required=True)
    for command in ("tick","backup","status","probe"): commands.add_parser(command)
    prune=commands.add_parser("prune");prune.add_argument("--apply",action="store_true")
    freeze=commands.add_parser("freeze");freeze.add_argument("--before",type=instant)
    restore=commands.add_parser("restore");restore.add_argument("frozen",type=Path);restore.add_argument("destination",type=Path)
    for command in ("drill","drill-due"):
        drill=commands.add_parser(command);drill.add_argument("--major",type=int,required=True)
    monitor=commands.add_parser("monitor")
    monitor.add_argument("--state",type=Path,required=True);monitor.add_argument("--probe-command",required=True);monitor.add_argument("--smtp-config",type=Path,required=True)
    monitor.add_argument("--require-schedule",action="store_true")
    monitor.add_argument("--interval",type=int,default=60);monitor.add_argument("--failures",type=int,default=2)
    monitor.add_argument("--max-age-hours",type=int,default=26);monitor.add_argument("--warn",type=int,default=80);monitor.add_argument("--critical",type=int,default=90)
    args=parser.parse_args();now=datetime.now(UTC)
    if args.command=="monitor":
        instance=Monitor(args.state,SmtpEmail(private_config(args.smtp_config)),args.interval,args.failures,args.max_age_hours,args.warn,args.critical,args.require_schedule)
        print(json.dumps(instance.check(now,lambda:json.loads(run_process([args.probe_command],10)))))
        return 0
    if args.root is None: parser.error("--root is required for this job")
    receiver=None
    if args.receiver_config is not None:
        from receiver import Receiver
        receiver=Receiver(args.receiver_config)
        if args.root.absolute()!=receiver.root: raise ValueError("receiver_archive_mismatch")
    process=NativeProcess(private_config(args.physical_env),private_config(args.logical_env),args.receiver_state_command,args.timeout,receiver)
    ops=Operations(args.root,process,lambda:datetime.now(UTC))
    if args.command=="tick":
        ran=ops.tick(now);print(json.dumps({"ran":ran}))
        if ran and ops.status()["failures"]: return 1
    elif args.command=="backup":
        ops.backup(now);status=ops.status();print(json.dumps(status))
        if status["failures"]: return 1
    elif args.command=="status": print(json.dumps(ops.status()))
    elif args.command=="probe": print(json.dumps(ops.probe(now,args.schedule_job is not None)))
    elif args.command=="prune": print(json.dumps(ops.prune(now,args.apply)))
    elif args.command=="freeze":
        if os.environ.get("RITMO_RECOVERY_QUARANTINE")!="true": raise ValueError("freeze_requires_quarantine")
        if receiver is None: raise ValueError("freeze_requires_native_receiver_guard")
        with receiver.freeze_guard(): frozen=ops.freeze(now,args.before)
        print(frozen)
    elif args.command=="restore": ops.restore(args.frozen,args.destination,os.environ.get("RITMO_RECOVERY_QUARANTINE")=="true")
    elif args.command=="drill": return 0 if ops.drill(now,args.major) else 1
    elif args.command=="drill-due":
        due=ops.drill_due(now,args.major);print(json.dumps({"due":due,"scope":"local"}));return 1 if due else 0
    return 0


if __name__=="__main__":
    try: raise SystemExit(main())
    except (OSError,ValueError,KeyError,TypeError,RuntimeError,subprocess.SubprocessError):
        # Avoid accidentally printing credentials/private process output in scheduler logs.
        print("operational_job_failed",file=__import__("sys").stderr)
        raise SystemExit(1) from None
