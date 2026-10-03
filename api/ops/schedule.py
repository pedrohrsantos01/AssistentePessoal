"""Native finite-job evidence and health. No scheduler or connection starts on import."""
from __future__ import annotations

import argparse
import fcntl
import json
import os
import re
import sys
import time
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

from operations import UTC, read_json, run_process, stamp, write_json
from receiver import trusted

ROOT = Path('/var/lib/ritmo-jobs')
JOBS = ('backup', 'monitor', 'watchdog')
RESULTS = {'success', 'timeout', 'exit-code', 'signal', 'core-dump', 'resources', 'protocol',
           'watchdog', 'start-limit-hit', 'oom-kill'}


def properties(unit: str, isolated: bool = True) -> dict[str, str]:
    output = run_process(['systemctl', 'show', unit, '--property=LoadState,FragmentPath,ActiveState,SubState,Type,User,KillMode,MainPID,ControlGroup,Result,ExecMainStartTimestampMonotonic,InvocationID,Unit'], 5, isolated=isolated)
    return dict(line.split('=', 1) for line in output.splitlines() if '=' in line)


def boot_id() -> str:
    return Path('/proc/sys/kernel/random/boot_id').read_text().strip()


def state(job: str) -> dict:
    trusted(ROOT, directory=True)
    if ROOT.stat().st_mode & 0o077: raise ValueError('job_state_requires_private_directory')
    path = ROOT / (job + '.json')
    trusted(path)
    if path.stat().st_mode & 0o077: raise ValueError('job_state_requires_private_file')
    value = read_json(path)
    if value['version'] != 1 or value['job'] != job: raise ValueError('invalid_job_state')
    if not re.fullmatch('[0-9a-f]{32}', value['invocation']): raise ValueError('invalid_job_invocation')
    if value['attempt'] is not None and not re.fullmatch('[0-9a-f]{32}', value['attempt']): raise ValueError('invalid_job_attempt')
    if value['result'] not in RESULTS | {'unknown'}: raise ValueError('invalid_job_result')
    if value['failure'] is not None:
        failure = value['failure']
        if not re.fullmatch('[0-9a-f]{32}', failure['invocation']) or failure['result'] not in RESULTS | {'unknown'} or failure['result'] == 'success':
            raise ValueError('invalid_job_failure')
    return value


@contextmanager
def locked():
    trusted(ROOT, directory=True)
    if ROOT.stat().st_mode & 0o077: raise ValueError('job_state_requires_private_directory')
    path = ROOT / 'evidence.lock'
    fd = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        trusted(path)
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally: os.close(fd)


def begin(job: str) -> None:
    invocation = os.environ.get('INVOCATION_ID', '')
    if not re.fullmatch('[0-9a-f]{32}', invocation): raise ValueError('native_invocation_required')
    with locked():
        proof = state(job) if (ROOT / (job + '.json')).exists() else {
            'version': 1, 'job': job, 'completed': None, 'monotonic': 0, 'boot': boot_id(),
            'invocation': invocation, 'result': 'unknown', 'failure': None, 'attempt': None}
        if proof['attempt'] is not None:
            proof['failure'] = {'invocation': proof['attempt'], 'completed': stamp(datetime.now(UTC)), 'result': 'unknown'}
        proof['attempt'] = invocation
        write_json(ROOT / (job + '.json'), proof, replace=True)

def record(job: str) -> None:
    invocation = os.environ.get('INVOCATION_ID', '')
    if not re.fullmatch('[0-9a-f]{32}', invocation): raise ValueError('native_invocation_required')
    result = os.environ.get('SERVICE_RESULT', 'unknown')
    if result not in RESULTS: result = 'unknown'
    with locked():
        failure = state(job)['failure'] if (ROOT / (job + '.json')).exists() else None
        now = stamp(datetime.now(UTC))
        if result != 'success': failure = {'invocation': invocation, 'completed': now, 'result': result}
        write_json(ROOT / (job + '.json'), {'version': 1, 'job': job, 'completed': now,
            'monotonic': time.monotonic(), 'boot': boot_id(), 'invocation': invocation,
            'result': result, 'failure': failure, 'attempt': None}, replace=True)


def health(job: str, isolated: bool = True) -> dict[str, bool]:
    available = False; failed = False
    try:
        service = properties('ritmo-' + job + '.service',isolated)
        timer = properties('ritmo-' + job + '.timer',isolated)
        failed = service.get('Result') in RESULTS - {'success'} or service.get('ActiveState') == 'failed'
        proof = state(job) if (ROOT / (job + '.json')).exists() else None
        if proof is not None:
            failed = failed or proof['failure'] is not None or (proof['attempt'] is not None and service.get('ActiveState') in ('inactive', 'failed'))
        for unit, kind in ((service, 'service'), (timer, 'timer')):
            if unit['LoadState'] != 'loaded' or unit['FragmentPath'] != '/etc/systemd/system/ritmo-' + job + '.' + kind:
                raise ValueError('native_unit_required')
        if timer['ActiveState'] != 'active' or timer['Unit'] != 'ritmo-' + job + '.service': raise ValueError('native_timer_inactive')
        if service['Type'] != 'oneshot' or service['User'] != 'root' or service['KillMode'] != 'control-group': raise ValueError('invalid_job_unit')
        if service['ActiveState'] == 'activating' and service['SubState'] == 'start':
            if proof is None or proof['attempt'] != service['InvocationID']: raise ValueError('native_attempt_required')
            pid = int(service['MainPID'])
            if pid <= 0 or Path('/proc/' + str(pid)).stat().st_uid != 0: raise ValueError('job_process_required')
            if '0::' + service['ControlGroup'] not in Path('/proc/' + str(pid) + '/cgroup').read_text().splitlines(): raise ValueError('job_cgroup_required')
            available = True
        elif service['ActiveState'] in ('inactive', 'failed') and proof is not None:
            elapsed = time.monotonic() - proof['monotonic']
            started = int(service['ExecMainStartTimestampMonotonic']) / 1000000
            available = proof['attempt'] is None and proof['boot'] == boot_id() and 0 <= elapsed <= 120 and started > 0 and started <= proof['monotonic']
    except (OSError, ValueError, KeyError, TypeError, RuntimeError):
        available = False
    return {'available': available, 'failed': failed}


def acknowledge(job: str, invocation: str) -> None:
    if not re.fullmatch('[0-9a-f]{32}', invocation): raise ValueError('invalid_failure_id')
    with locked():
        service = properties('ritmo-' + job + '.service')
        timer = properties('ritmo-' + job + '.timer')
        if service['ActiveState'] not in ('inactive', 'failed') or timer['ActiveState'] not in ('inactive', 'failed'):
            raise ValueError('stop_job_and_timer_before_ack')
        proof = state(job)
        if proof['failure'] is None or proof['failure']['invocation'] != invocation: raise ValueError('failure_id_mismatch')
        proof['failure'] = None
        write_json(ROOT / (job + '.json'), proof, replace=True)

def main() -> int:
    if sys.platform != 'linux' or os.geteuid() != 0: raise ValueError('job_control_requires_linux_root')
    parser = argparse.ArgumentParser(description='Native job evidence; see linux-scheduling.md')
    parser.add_argument('command', choices=('begin', 'record', 'health', 'ack'))
    parser.add_argument('--job', choices=JOBS, required=True)
    parser.add_argument('--failure')
    args = parser.parse_args()
    if args.command == 'begin': begin(args.job)
    elif args.command == 'record': record(args.job)
    elif args.command == 'ack': acknowledge(args.job, args.failure or '')
    else: print(json.dumps(health(args.job)))
    return 0


if __name__ == '__main__':
    try: raise SystemExit(main())
    except (OSError, ValueError, KeyError, TypeError, RuntimeError):
        print('operational_schedule_failed', file=sys.stderr)
        raise SystemExit(1) from None
