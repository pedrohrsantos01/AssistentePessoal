"""Restart systemd PID 1 preserving the fixture filesystem, without rebooting the host."""
import json
import sys
from test_schedule_linux import ROOT, UNIT, command, health, wait

if sys.argv[1]=='before':
    (UNIT/'ritmo-backup.service.d'/'fixture.conf').write_text('[Service]\nExecStart=\nExecStart=/usr/bin/false\n')
    (UNIT/'ritmo-backup.timer.d'/'fixture.conf').write_text('[Timer]\nOnCalendar=\nOnBootSec=\nOnCalendar=*-*-* *:*:00 UTC\nOnBootSec=1s\nAccuracySec=1ms\n')
    command('systemctl','daemon-reload')
    command('systemctl','start','ritmo-backup.service',check=False)
    failure=json.loads((ROOT/'backup.json').read_text())['failure']
    (ROOT/'expected-failure').write_text(json.dumps(failure))
    (UNIT/'ritmo-backup.service.d'/'fixture.conf').write_text('[Service]\nExecStart=\nExecStart=/usr/bin/true\n')
    command('systemctl','daemon-reload')
    command('systemctl','enable','ritmo-backup.timer')
else:
    wait(lambda:health()['available'],15)
    assert health()['failed'] is True
    proof=json.loads((ROOT/'backup.json').read_text())
    assert proof['result']=='success'
    assert proof['failure']==json.loads((ROOT/'expected-failure').read_text())
    command('systemctl','stop','ritmo-backup.timer')
    print('native_restart_failure_preserved')
