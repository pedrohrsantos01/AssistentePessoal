import pathlib
import signal
import subprocess
import sys
import time
root=pathlib.Path('/var/lib/ritmo-jobs')
signal.signal(signal.SIGTERM,signal.SIG_IGN)
child=subprocess.Popen([sys.executable,'-c','import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(60)'],start_new_session=True)
(root/'child').write_text(str(child.pid))
time.sleep(60)
