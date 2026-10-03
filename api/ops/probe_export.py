"""Privileged fixed metadata exporter; only this exact program is allowed by sudo."""
from datetime import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

from operations import UTC, Operations, NativeProcess, SmtpEmail, read_json, stamp
from probe_transport import bounded_process, config, metadata
from receiver import Receiver, trusted
from schedule import health

CONFIG = Path("/etc/ritmo/probe-export.json")


def export() -> dict:
    values = config(CONFIG)
    if set(values) != {"kind"} or values["kind"] not in ("receiver", "detector"): raise ValueError("invalid_export_config")
    kind = values["kind"]; now = datetime.now(UTC)
    if kind == "receiver":
        receiver = Receiver()
        process = NativeProcess(config(Path("/etc/ritmo/physical.json")), {}, None, receiver=receiver, isolated=False)
        report = Operations(receiver.root, process).probe(now, include_schedule=True)
        status = report
        report = {key: report[key] for key in ("primary", "receiver", "catalogValid", "physical", "logical", "storagePercent", "schedule")}
        for key in ("failures", "incomplete"):
            report[key] = [{"kind": item["kind"], "at": item["at"]} for item in status[key]]
        report["watchdog"] = health("watchdog",isolated=False)
    else:
        checked = None; root = Path("/srv/ritmo-monitor")
        try:
            state = trusted(root / "state.json")
            if state.stat().st_mode & 0o077: raise ValueError("private_monitor_state_required")
            checked = read_json(state)["checked"]
        except (OSError, ValueError, KeyError, TypeError): pass
        try: smtp = SmtpEmail(config(Path("/etc/ritmo/smtp.json"))).health()
        except (OSError, ValueError, KeyError, TypeError, RuntimeError, subprocess.SubprocessError): smtp = False
        disk = shutil.disk_usage(root if root.exists() else Path("/srv"))
        report = {"checked": checked, "schedule": health("monitor",isolated=False), "smtp": smtp,
                  "storagePercent": 100 * (disk.total - disk.free) / disk.total}
    return metadata({**report, "version": 1, "kind": kind, "at": stamp(now)}, kind)


if __name__ == "__main__":
    try:
        if os.geteuid() != 0: raise ValueError("export_requires_root")
        if sys.argv[1:] == ["--worker"]:
            print(json.dumps(export(), allow_nan=False))
        elif len(sys.argv) == 1:
            trusted(Path(__file__).absolute())
            sys.stdout.buffer.write(bounded_process(["/usr/bin/python3", str(Path(__file__).absolute()), "--worker"], 8))
        else: raise ValueError("invalid_export_arguments")
    except (OSError, ValueError, KeyError, TypeError, RuntimeError, subprocess.SubprocessError):
        print("private_probe_export_failed", file=sys.stderr)
        raise SystemExit(1) from None
