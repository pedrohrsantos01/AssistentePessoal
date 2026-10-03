"""Bounded fixed-command SSH transport. Linux only; import starts no process."""
from __future__ import annotations

from datetime import datetime, timedelta
import ipaddress
import json
import math
import os
from pathlib import Path
import selectors
import signal
import subprocess
import sys
import time


LIMIT = 256 * 1024
NETWORKS = tuple(ipaddress.ip_network(n) for n in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8"))


def config(path: Path) -> dict:
    from receiver import trusted
    trusted(path)
    if path.stat().st_mode & 0o077: raise ValueError("probe_requires_private_file")
    return json.loads(path.read_text(encoding="utf-8"))


def utc(value: str) -> datetime:
    if not isinstance(value, str): raise ValueError("invalid_probe_time")
    result = datetime.fromisoformat(value)
    if result.utcoffset() != timedelta(0): raise ValueError("probe_requires_utc")
    return result


def metadata(report: dict, kind: str) -> dict:
    if kind == "primary":
        if not isinstance(report,dict) or set(report)!={"version","kind","at","database","durable","slot","storage"}:
            raise ValueError("invalid_primary_fields")
        if type(report["version"]) is not int or report["version"]!=1 or report["kind"]!=kind: raise ValueError("invalid_probe_identity")
        utc(report["at"])
        if type(report["database"]) is not bool: raise ValueError("invalid_primary_database")
        storage=report["storage"]
        if not isinstance(storage,dict) or set(storage)!={"data","wal"}: raise ValueError("invalid_primary_storage")
        for percent in storage.values():
            if type(percent) not in (int,float) or not math.isfinite(percent) or not 0<=percent<=100: raise ValueError("invalid_primary_storage")
        slot=report["slot"]
        if not report["database"]:
            if report["durable"] is not None or slot is not None: raise ValueError("unknown_primary_requires_null")
        else:
            if type(report["durable"]) is not bool or not isinstance(slot,dict) or set(slot)!={"present","active","healthy","invalidated","status","retainedBytes"}:
                raise ValueError("invalid_primary_slot")
            if any(type(slot[key]) is not bool for key in ("present","active","healthy","invalidated")): raise ValueError("invalid_primary_slot")
            if slot["status"] not in (None,"reserved","extended","unreserved","lost"): raise ValueError("invalid_primary_slot")
            size=slot["retainedBytes"]
            if size is not None and (type(size) is not int or size<0): raise ValueError("invalid_primary_retention")
            if slot["healthy"] and not (slot["present"] and slot["active"] and not slot["invalidated"] and slot["status"] in ("reserved","extended") and size is not None):
                raise ValueError("contradictory_primary_slot")
        return report
    common = {"version", "kind", "at", "storagePercent", "schedule"}
    extra = ({"primary", "receiver", "catalogValid", "physical", "logical", "failures", "incomplete", "watchdog"}
             if kind == "receiver" else {"checked", "smtp"})
    if kind not in ("receiver", "detector") or not isinstance(report, dict) or set(report) != common | extra:
        raise ValueError("invalid_probe_fields")
    if type(report["version"]) is not int or report["version"] != 1 or report["kind"] != kind: raise ValueError("invalid_probe_identity")
    utc(report["at"])
    percent = report["storagePercent"]
    if type(percent) not in (int, float) or not 0 <= percent <= 100 or not math.isfinite(percent): raise ValueError("invalid_probe_storage")
    for key in (("schedule", "watchdog") if kind == "receiver" else ("schedule",)):
        item = report[key]
        if not isinstance(item, dict) or set(item) != {"available", "failed"} or any(type(v) is not bool for v in item.values()):
            raise ValueError("invalid_probe_schedule")
    for key in (("primary", "receiver", "catalogValid") if kind == "receiver" else ("smtp",)):
        if type(report[key]) is not bool: raise ValueError("invalid_probe_boolean")
    for key in (("physical", "logical") if kind == "receiver" else ("checked",)):
        if report[key] is not None: utc(report[key])
    if kind == "receiver":
        for key in ("failures", "incomplete"):
            events = report[key]
            if not isinstance(events, list) or len(events) > 3: raise ValueError("invalid_probe_events")
            for event in events:
                if not isinstance(event, dict) or set(event) != {"kind", "at"} or event["kind"] not in ("physical", "logical", "drill"):
                    raise ValueError("invalid_probe_event")
                utc(event["at"])
    return report


def bounded_process(args: list[str], timeout: float, isolated: bool = True, environment: dict[str,str] | None = None) -> bytes:
    """Limit both wall-clock duration and memory; discard potentially secret stderr."""
    if sys.platform != "linux": raise ValueError("probe_requires_linux")
    deadline = time.monotonic() + timeout
    output = bytearray()
    with subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                          env=environment or {"PATH": "/usr/bin:/bin", "LC_ALL": "C"}, start_new_session=isolated) as child:
        try:
            with selectors.DefaultSelector() as selector:
                selector.register(child.stdout, selectors.EVENT_READ)
                while True:
                    left = deadline - time.monotonic()
                    if left <= 0: raise RuntimeError("probe_timeout")
                    if not selector.select(left): raise RuntimeError("probe_timeout")
                    block = os.read(child.stdout.fileno(), min(65536, LIMIT + 1 - len(output)))
                    if not block: break
                    output.extend(block)
                    if len(output) > LIMIT: raise RuntimeError("probe_output_limit")
            if child.wait(timeout=max(0.001, deadline - time.monotonic())) != 0: raise RuntimeError("probe_process_failed")
            return bytes(output)
        finally:
            # Also reap descendants that kept stdout open after the parent exited.
            try:
                if isolated: os.killpg(child.pid, signal.SIGKILL)
                elif child.poll() is None: child.kill()
            except ProcessLookupError: pass
            child.wait()
            child.stdout.close()


def fetch(path: Path) -> dict:
    from receiver import trusted
    values = config(path)
    if set(values) - {"host", "port", "keyFile", "knownHostsFile", "kind", "timeout"}: raise ValueError("invalid_probe_config")
    address = ipaddress.IPv4Address(values["host"])
    if not any(address in net for net in NETWORKS) or address.is_unspecified or address.is_multicast:
        raise ValueError("probe_requires_private_address")
    port = values["port"]; timeout = values.get("timeout", 10)
    if type(port) is not int or not 1 <= port <= 65535 or type(timeout) is not int or not 1 <= timeout <= 10:
        raise ValueError("invalid_probe_bounds")
    kind = values["kind"]
    if kind not in ("receiver", "detector", "primary"): raise ValueError("invalid_probe_kind")
    key = trusted(Path(values["keyFile"])); hosts = trusted(Path(values["knownHostsFile"]))
    if key.stat().st_mode & 0o077: raise ValueError("probe_requires_private_key")
    args = ["/usr/bin/ssh", "-F", "/dev/null", "-T", "-i", str(key), "-p", str(port)]
    for option in ("BatchMode=yes", "StrictHostKeyChecking=yes", "GlobalKnownHostsFile=/dev/null",
                   "IdentitiesOnly=yes", "IdentityAgent=none", "ClearAllForwardings=yes",
                   "ConnectTimeout=3", "ConnectionAttempts=1", "ServerAliveInterval=2", "ServerAliveCountMax=1",
                   "UserKnownHostsFile=" + str(hosts)):
        args += ["-o", option]
    args += ["ritmo-probe@" + str(address), "ritmo-probe-v1"]
    return metadata(json.loads(bounded_process(args, timeout, isolated=False).decode("utf-8")), kind)


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2: raise ValueError("invalid_probe_arguments")
        print(json.dumps(fetch(Path(sys.argv[1])), allow_nan=False))
    except (OSError, ValueError, KeyError, TypeError, RuntimeError, subprocess.SubprocessError):
        print("private_probe_failed", file=sys.stderr)
        raise SystemExit(1) from None
