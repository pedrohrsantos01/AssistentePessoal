"""Public CLI + actual systemd. Only external process and timer intervals are controlled."""
import json
import pathlib
import subprocess
import time
import unittest

ROOT=pathlib.Path('/var/lib/ritmo-jobs')
UNIT=pathlib.Path('/etc/systemd/system')

def command(*args, check=True):
    result=subprocess.run(args, capture_output=True, text=True, timeout=15)
    if check and result.returncode: raise AssertionError(result.stderr + result.stdout)
    return result

def wait(predicate, timeout=10):
    until=time.monotonic()+timeout
    while time.monotonic()<until:
        if predicate(): return
        time.sleep(.05)
    raise AssertionError('native_job_deadline')

def property(name):
    return command('systemctl','show','ritmo-backup.service','--property='+name,'--value').stdout.strip()

def health():
    return json.loads(command('python3','/opt/ritmo/schedule.py','health','--job','backup').stdout)

class NativeSchedule(unittest.TestCase):
    def setUp(self):
        ROOT.mkdir(mode=0o700, exist_ok=True)
        command('install','-d','-m','700','/srv/ritmo-recovery')
        command('cp','/opt/ritmo/ritmo-backup.service','/opt/ritmo/ritmo-backup.timer',str(UNIT))
        drop=UNIT/'ritmo-backup.service.d';drop.mkdir(exist_ok=True)
        (drop/'fixture.conf').write_text('[Unit]\nStartLimitIntervalSec=0\n[Service]\nExecStart=\nExecStart=/usr/bin/python3 /opt/fixture/job.py\nTimeoutStartSec=10s\n')
        drop=UNIT/'ritmo-backup.timer.d';drop.mkdir(exist_ok=True)
        (drop/'fixture.conf').write_text('[Timer]\nOnCalendar=\nOnBootSec=\nOnActiveSec=100ms\nOnUnitInactiveSec=200ms\nAccuracySec=1ms\n')
        command('systemctl','daemon-reload')
        command('systemctl','reset-failed','ritmo-backup.service',check=False)
        (ROOT/'mode').write_text('slow')

    def tearDown(self):
        command('systemctl','stop','ritmo-backup.timer','ritmo-backup.service',check=False)
        for path in ROOT.glob('*'):
            if path.is_file(): path.unlink()

    def test_timer_starts_a_finite_job_without_overlap_and_exposes_stopped_agenda(self):
        self.assertFalse(health()['available'])
        command('systemctl','start','ritmo-backup.timer')
        wait(lambda:(ROOT/'entered').exists())
        pid=property('MainPID')
        # Repeated native Start cannot spawn a second instance while this oneshot runs.
        command('systemctl','start','--no-block','ritmo-backup.service')
        time.sleep(.4)
        self.assertEqual(property('MainPID'),pid)
        self.assertEqual((ROOT/'entered').read_text(),'x')
        self.assertTrue(health()['available'])
        (ROOT/'release').touch()
        wait(lambda:(ROOT/'backup.json').exists() and json.loads((ROOT/'backup.json').read_text())['completed'] is not None)
        wait(lambda:health()['available'])
        command('systemctl','stop','ritmo-backup.timer')
        self.assertFalse(health()['available'])

    def test_failure_before_exec_survives_success_and_requires_explicit_matching_ack(self):
        drop=UNIT/'ritmo-backup.service.d'/'fixture.conf'
        drop.write_text('[Unit]\nStartLimitIntervalSec=0\n[Service]\nExecStart=\nExecStart=/opt/fixture/not-present\n')
        command('systemctl','daemon-reload')
        command('systemctl','start','ritmo-backup.timer')
        wait(lambda:(ROOT/'backup.json').exists() and json.loads((ROOT/'backup.json').read_text())['completed'] is not None)
        command('systemctl','stop','ritmo-backup.timer')
        failure=json.loads((ROOT/'backup.json').read_text())['failure']
        self.assertEqual(failure['result'],'exit-code')
        self.assertTrue(health()['failed'])
        drop.write_text('[Unit]\nStartLimitIntervalSec=0\n[Service]\nExecStart=\nExecStart=/usr/bin/true\n')
        command('systemctl','daemon-reload')
        command('systemctl','start','ritmo-backup.service')
        self.assertEqual(json.loads((ROOT/'backup.json').read_text())['failure'],failure)
        self.assertNotEqual(command('python3','/opt/ritmo/schedule.py','ack','--job','backup','--failure','0'*32,check=False).returncode,0)
        command('python3','/opt/ritmo/schedule.py','ack','--job','backup','--failure',failure['invocation'])
        command('systemctl','start','ritmo-backup.timer')
        wait(lambda:health()['available'])
        self.assertFalse(health()['failed'])
    def test_timeout_terminates_detached_child_and_records_failure(self):
        drop=UNIT/'ritmo-backup.service.d'/'fixture.conf'
        drop.write_text('[Service]\nExecStart=\nExecStart=/usr/bin/python3 /opt/fixture/timeout.py\nTimeoutStartSec=2s\nTimeoutStopSec=2s\n')
        command('systemctl','daemon-reload')
        command('systemctl','start','--no-block','ritmo-backup.service')
        wait(lambda:(ROOT/'child').exists())
        pid=(ROOT/'child').read_text().strip()
        wait(lambda:property('ActiveState')=='failed')
        self.assertFalse(pathlib.Path('/proc/'+pid).exists())
        self.assertEqual(json.loads((ROOT/'backup.json').read_text())['failure']['result'],'timeout')
        self.assertTrue(health()['failed'])

    def test_persistent_calendar_recovers_missed_activation_without_changing_host_clock(self):
        drop=UNIT/'ritmo-backup.timer.d'/'fixture.conf'
        # The next hourly activation is in the future. Only Persistent may trigger it now.
        drop.write_text('[Timer]\nOnCalendar=\nOnBootSec=\nOnCalendar=*-*-* *:00:00 UTC\nAccuracySec=1ms\n')
        command('systemctl','daemon-reload')
        stamps=pathlib.Path('/var/lib/systemd/timers');stamps.mkdir(exist_ok=True)
        previous=stamps/'stamp-ritmo-backup.timer';previous.touch()
        import os
        os.utime(previous,(946684800,946684800))
        (ROOT/'release').touch()
        command('systemctl','start','ritmo-backup.timer')
        wait(lambda:(ROOT/'backup.json').exists() and json.loads((ROOT/'backup.json').read_text())['completed'] is not None,5)
        self.assertEqual((ROOT/'entered').read_text(),'x')
        self.assertEqual(json.loads((ROOT/'backup.json').read_text())['result'],'success')
    def test_probe_cli_reports_native_agenda_and_monitor_unit_is_finite(self):
        command('systemctl','start','ritmo-backup.timer')
        wait(lambda:(ROOT/'entered').exists())
        probe=json.loads(command('python3','/opt/ritmo/operations.py','--root','/srv/ritmo-recovery','--schedule-job','backup','probe').stdout)
        self.assertEqual(probe['schedule'],{'available':True,'failed':False})
        command('systemctl','stop','ritmo-backup.timer')
        probe=json.loads(command('python3','/opt/ritmo/operations.py','--root','/srv/ritmo-recovery','--schedule-job','backup','probe').stdout)
        self.assertFalse(probe['schedule']['available'])
        # A previously plausible receipt cannot prove an execution whose final publication is absent.
        (ROOT/'release').touch()
        wait(lambda:(ROOT/'backup.json').exists() and json.loads((ROOT/'backup.json').read_text())['completed'] is not None)
        drop=UNIT/'ritmo-backup.service.d'/'fixture.conf'
        drop.write_text('[Service]\nExecStart=\nExecStart=/usr/bin/true\nExecStopPost=\nExecStopPost=/usr/bin/true\n')
        command('systemctl','daemon-reload')
        command('systemctl','start','ritmo-backup.service')
        timer=UNIT/'ritmo-backup.timer.d'/'fixture.conf'
        timer.write_text('[Timer]\nOnCalendar=\nOnBootSec=\nOnActiveSec=100s\nAccuracySec=1ms\n')
        command('systemctl','daemon-reload')
        command('systemctl','start','ritmo-backup.timer')
        self.assertFalse(health()['available'])
        command('systemctl','stop','ritmo-backup.timer','ritmo-backup.service')
        drop.write_text('[Service]\nExecStart=\nExecStart=/usr/bin/true\n')
        command('systemctl','daemon-reload')
        command('systemctl','start','ritmo-backup.service')
        # A later successful call cannot silently erase the missing terminal publication.
        self.assertIsNotNone(json.loads((ROOT/'backup.json').read_text())['failure'])
        self.assertTrue(health()['failed'])
        command('install','-d','-m','700','/srv/ritmo-monitor')
        command('cp','/opt/ritmo/ritmo-monitor.service','/opt/ritmo/ritmo-monitor.timer',str(UNIT))
        drop=UNIT/'ritmo-monitor.service.d';drop.mkdir(exist_ok=True)
        (drop/'fixture.conf').write_text('[Service]\nExecStart=\nExecStart=/usr/bin/true\n')
        command('systemctl','daemon-reload')
        command('systemd-analyze','verify',str(UNIT/'ritmo-backup.timer'),str(UNIT/'ritmo-monitor.timer'))
        command('systemctl','start','ritmo-monitor.timer')
        command('systemctl','start','ritmo-monitor.service')
        monitor=json.loads(command('python3','/opt/ritmo/schedule.py','health','--job','monitor').stdout)
        self.assertEqual(monitor,{'available':True,'failed':False})
        command('systemctl','stop','ritmo-monitor.timer')
if __name__=='__main__': unittest.main()
