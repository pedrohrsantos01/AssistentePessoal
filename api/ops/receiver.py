"""Native Linux receiver lifecycle. No process or connection starts on import."""
from __future__ import annotations

import argparse
import json
import os
import pwd
import re
import signal
import stat
import subprocess
import sys
import time
from contextlib import contextmanager
from pathlib import Path

UNIT = "ritmo-wal-receiver.service"
USER = "ritmo-receiver"
CONFIG = Path("/etc/ritmo/receiver.json")


def trusted(path: Path, owner: int = 0, directory: bool = False) -> Path:
    if not path.is_absolute() or any(p.is_symlink() for p in [path, *path.parents]):
        raise ValueError("receiver_requires_absolute_trusted_path")
    info = path.stat()
    expected = stat.S_ISDIR if directory else stat.S_ISREG
    if not expected(info.st_mode) or info.st_uid != owner or info.st_mode & 0o022:
        raise ValueError("receiver_requires_protected_path")
    # Ancestors cannot let an unprivileged writer replace the trusted object.
    for parent in path.parents:
        info = parent.stat()
        if info.st_uid != 0 or info.st_mode & 0o022:
            raise ValueError("receiver_requires_protected_parent")
    return path


def fsync_directory(path: Path) -> None:
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try: os.fsync(fd)
    finally: os.close(fd)


class Receiver:
    def __init__(self, config: Path = CONFIG):
        if sys.platform != "linux" or not Path("/sys/fs/cgroup/cgroup.controllers").is_file(): raise ValueError("receiver_requires_linux_cgroup_v2")
        with trusted(config).open(encoding="utf-8") as stream: values = json.load(stream)
        if set(values) != {"root", "control", "binary", "environmentFile"}: raise ValueError("invalid_receiver_config")
        self.uid = pwd.getpwnam(USER).pw_uid
        self.root = Path(values["root"]); self.control = trusted(Path(values["control"]), directory=True)
        # The archive root belongs to the service; its parent remains root-owned.
        trusted(self.root, self.uid, directory=True)
        self.wal = self.root / "wal"
        info = self.wal.stat()
        if self.wal.is_symlink() or not self.wal.is_dir() or info.st_uid != self.uid or info.st_mode & 0o077:
            raise ValueError("receiver_requires_private_wal")
        self.binary = trusted(Path(values["binary"]))
        with trusted(Path(values["environmentFile"])).open(encoding="utf-8") as stream: self.environment = json.load(stream)
        allowed = {"PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGAPPNAME", "PGSSLMODE", "PGSSLROOTCERT", "PGPASSFILE", "PGCONNECT_TIMEOUT"}
        if not set(self.environment) <= allowed or not all(isinstance(v,str) and v and "\0" not in v for v in self.environment.values()):
            raise ValueError("invalid_receiver_environment")
        for key,value in {"PGUSER":"ritmo_wal_receiver", "PGAPPNAME":"ritmo_wal", "PGSSLMODE":"verify-full"}.items():
            if self.environment.get(key) != value: raise ValueError("receiver_requires_replication_identity_and_tls")
        for key in ("PGHOST", "PGPORT", "PGDATABASE", "PGSSLROOTCERT", "PGPASSFILE"):
            if key not in self.environment: raise ValueError("incomplete_receiver_environment")
        if not re.fullmatch(r"[A-Za-z0-9_.:-]+", self.environment["PGHOST"]): raise ValueError("receiver_requires_single_tcp_host")
        port = self.environment["PGPORT"]; timeout = self.environment.get("PGCONNECT_TIMEOUT", "5")
        if not port.isdecimal() or not 1<=int(port)<=65535 or not timeout.isdecimal() or not 1<=int(timeout)<=30:
            raise ValueError("invalid_receiver_connection_bounds")
        trusted(Path(self.environment["PGSSLROOTCERT"]))
        passfile = trusted(Path(self.environment["PGPASSFILE"]), self.uid)
        if passfile.stat().st_mode & 0o077: raise ValueError("receiver_requires_private_passfile")
        version = self.command([str(self.binary), "--version"])
        if not re.match(r"pg_receivewal \(PostgreSQL\) 18(?:\.|\s)", version): raise ValueError("receiver_requires_pg18")
        self.marker = self.control / "inhibited"
        self.guarded = False
        for name in ("writer.lock", "admin.lock"): trusted(self.control / name)

    @staticmethod
    def command(args: list[str]) -> str:
        result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=35, check=False)
        if result.returncode: raise RuntimeError("receiver_supervisor_command_failed")
        return result.stdout.decode("utf-8").strip()

    def arguments(self) -> list[str]:
        return [str(self.binary), "--no-password", "--synchronous", "--slot=ritmo_wal", "--status-interval=1", "--directory="+str(self.wal)]

    def inhibited(self) -> bool:
        if self.marker.is_symlink(): raise ValueError("receiver_invalid_inhibition")
        if not self.marker.exists(): return False
        trusted(self.marker)
        return True

    @contextmanager
    def lock(self, name: str):
        import fcntl
        path = trusted(self.control / (name+".lock"))
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            yield fd
        finally: os.close(fd)

    def writer_busy(self) -> bool:
        try:
            with self.lock("writer"): return False
        except BlockingIOError: return True

    def properties(self) -> dict[str,str]:
        names = ["LoadState", "ActiveState", "SubState", "MainPID", "ControlGroup", "User", "KillMode", "FragmentPath"]
        output = self.command(["systemctl", "show", "--no-pager", "--property="+",".join(names), UNIT])
        values = dict(line.split("=",1) for line in output.splitlines())
        if values.get("LoadState") != "loaded" or values.get("User") != USER or values.get("KillMode") != "control-group" or values.get("FragmentPath") != "/etc/systemd/system/"+UNIT:
            raise RuntimeError("receiver_unit_not_verified")
        return values

    def writers(self) -> set[int]:
        found = set()
        for path in Path("/proc").iterdir():
            if not path.name.isdigit(): continue
            try:
                arguments = (path / "cmdline").read_bytes().split(b"\0")
                if not arguments or Path(os.fsdecode(arguments[0])).name != "pg_receivewal": continue
                decoded = [os.fsdecode(a) for a in arguments if a]
                for index,arg in enumerate(decoded):
                    directory = arg.split("=",1)[1] if arg.startswith("--directory=") else None
                    if arg in ("--directory", "-D") and index+1<len(decoded): directory = decoded[index+1]
                    elif arg.startswith("-D") and len(arg)>2: directory = arg[2:]
                    if directory is not None:
                        target = Path(directory)
                        target = (path / "root" / target.relative_to("/")) if target.is_absolute() else (path / "cwd" / target)
                        if os.path.samefile(target, self.wal): found.add(int(path.name))
            except (FileNotFoundError, ProcessLookupError): continue  # A process exited during inspection.
        return found

    def state(self) -> str:
        if os.geteuid() != 0: raise ValueError("receiver_state_requires_root")
        values = self.properties(); pid = int(values["MainPID"])
        group = values["ControlGroup"] or "/system.slice/"+UNIT
        if group != "/system.slice/"+UNIT: raise RuntimeError("receiver_cgroup_not_verified")
        procs = Path("/sys/fs/cgroup") / group.lstrip("/") / "cgroup.procs"
        members = set(map(int,procs.read_text().split())) if procs.exists() else set()
        writers = self.writers()
        if values["ActiveState"] == "active" and values["SubState"] == "running" and pid>0:
            path = Path("/proc") / str(pid)
            children = (path / "task" / str(pid) / "children").read_text().split()
            if len(children)!=1: raise RuntimeError("receiver_child_not_verified")
            child = int(children[0]); child_path = Path("/proc") / str(child)
            if members != {pid,child} or writers != {child} or not os.path.samefile(child_path / "exe", self.binary):
                raise RuntimeError("receiver_process_not_verified")
            supervisor_args = [sys.executable, str(Path(__file__).resolve()), "run"]
            if not os.path.samefile(path / "exe", sys.executable) or (path / "cmdline").read_bytes().split(b"\0")[:-1] != [os.fsencode(a) for a in supervisor_args]:
                raise RuntimeError("receiver_supervisor_not_verified")
            if path.stat().st_uid != self.uid or child_path.stat().st_uid != self.uid or (child_path / "cmdline").read_bytes().split(b"\0")[:-1] != [os.fsencode(a) for a in self.arguments()]:
                raise RuntimeError("receiver_identity_not_verified")
            if self.inhibited() or not self.writer_busy(): raise RuntimeError("receiver_writer_not_guarded")
            outcome = "running"
        elif values["ActiveState"] in ("inactive", "failed") and pid==0 and not members and not writers:
            if not self.guarded and self.writer_busy(): raise RuntimeError("receiver_writer_not_stopped")
            outcome = "stopped"
        else: raise RuntimeError("receiver_not_verified")
        # A PID file or a stale manager snapshot cannot establish the current identity.
        if values != self.properties(): raise RuntimeError("receiver_state_changed")
        return outcome

    def run(self) -> int:
        if os.geteuid() != self.uid: raise ValueError("receiver_run_requires_service_user")
        with self.lock("writer") as fd:
            if self.inhibited(): raise RuntimeError("receiver_inhibited")
            environment = {"PATH":"/usr/bin:/bin", "LC_ALL":"C", "PG_COLOR":"never", **self.environment}
            environment.setdefault("PGCONNECT_TIMEOUT", "5")
            stopping = False
            child = None
            def stop(signum, frame):
                nonlocal stopping
                stopping = True
                if child is not None and child.poll() is None: child.terminate()
            signal.signal(signal.SIGTERM, stop); signal.signal(signal.SIGINT, stop)
            transport_errors = ("could not receive data from WAL stream", "could not read COPY data", "could not send feedback packet",
                                "could not send copy-end packet", "replication stream was terminated before stop point")
            connection_errors = ("Connection refused", "Connection timed out", "Network is unreachable",
                                 "No route to host", "Temporary failure in name resolution", "timeout expired",
                                 "could not translate host name", "server closed the connection unexpectedly")
            while not stopping:
                fatal = False; transport = False
                # The child also holds the lease if this supervisor crashes before cgroup cleanup.
                with subprocess.Popen(self.arguments(), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                                      env=environment, pass_fds=(fd,)) as child:
                    for raw in iter(lambda: child.stderr.readline(4097), b""):
                        if len(raw)>4096: fatal = True
                        line = raw.decode("utf-8", errors="replace")
                        if line.startswith("pg_receivewal: error:"):
                            transient = any(message in line for message in transport_errors)
                            transient = transient or ("connection" in line and any(message in line for message in connection_errors))
                            transient = transient or "could not translate host name" in line
                            transient = transient or ("unexpected termination of replication stream" in line and "terminating connection due to administrator command" in line)
                            if any(message in line for message in ("requested WAL", "replication slot", "permission denied", "password", "certificate", "no pg_hba")): transient = False
                            if transient and not fatal: transport = True
                            else: fatal = True
                        if "could not finish writing WAL files" in line: fatal = True
                        if fatal and child.poll() is None: child.terminate()
                    code = child.wait()
                if stopping: return 0
                if fatal:
                    print("receiver_storage_or_protocol_failed", file=sys.stderr)
                    return 1
                if code<0: return 75
                if code!=0 and transport:
                    print("receiver_transport_retry", file=sys.stderr)
                    time.sleep(5)
                    continue
                return 1  # Unknown exit is not evidence of a recoverable transport failure.
            return 0

    def mark(self) -> None:
        if self.inhibited():
            with self.marker.open("rb") as stream: os.fsync(stream.fileno())
            fsync_directory(self.control)
            return
        fd = os.open(self.marker, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        try: os.write(fd,b"inhibited\n"); os.fsync(fd)
        finally: os.close(fd)
        fsync_directory(self.control)

    def inhibit(self) -> None:
        if os.geteuid() != 0: raise ValueError("receiver_control_requires_root")
        with self.lock("admin"):
            self.mark()
            self.command(["systemctl", "stop", UNIT])
            with self.lock("writer"):
                self.guarded = True
                try:
                    if self.state() != "stopped": raise RuntimeError("receiver_not_stopped")
                finally: self.guarded = False

    @contextmanager
    def freeze_guard(self):
        if os.geteuid() != 0: raise ValueError("receiver_freeze_requires_root")
        with self.lock("admin"), self.lock("writer"):
            self.guarded = True
            try:
                if not self.inhibited() or self.state() != "stopped": raise RuntimeError("receiver_freeze_requires_inhibition")
                yield
                if not self.inhibited() or self.state() != "stopped": raise RuntimeError("receiver_freeze_guard_changed")
            finally: self.guarded = False

    def resume(self) -> None:
        if os.geteuid() != 0: raise ValueError("receiver_control_requires_root")
        with self.lock("admin"):
            with self.lock("writer"):
                self.guarded = True
                try:
                    if self.state() != "stopped": raise RuntimeError("receiver_resume_requires_stopped")
                    if self.wal.stat().st_mode & 0o700 != 0o700: raise RuntimeError("receiver_resume_requires_writable_wal")
                    if self.inhibited(): self.marker.unlink(); fsync_directory(self.control)
                finally: self.guarded = False
            try:
                self.command(["systemctl", "reset-failed", UNIT])
                self.command(["systemctl", "start", UNIT])
                deadline = time.monotonic()+5
                while True:
                    try:
                        if self.state() == "running": break
                    except (OSError, ValueError, RuntimeError): pass
                    if time.monotonic() >= deadline: raise RuntimeError("receiver_start_not_verified")
                    time.sleep(0.1)
            except BaseException:
                self.mark()
                self.command(["systemctl", "stop", UNIT])
                raise


def main() -> int:
    parser = argparse.ArgumentParser(description="Native receiver lifecycle; see receiver-supervision.md")
    parser.add_argument("--config", type=Path, default=CONFIG)
    parser.add_argument("action", choices=("run", "state", "inhibit", "resume"))
    args = parser.parse_args()
    try:
        instance = Receiver(args.config)
        if args.action == "run": return instance.run()
        if args.action == "state": print(instance.state())
        else: getattr(instance, args.action)()
        return 0
    except (OSError, ValueError, KeyError, TypeError, RuntimeError, subprocess.SubprocessError):
        print("receiver_control_failed", file=sys.stderr)
        return 78 if args.action == "run" else 1


if __name__ == "__main__": raise SystemExit(main())
