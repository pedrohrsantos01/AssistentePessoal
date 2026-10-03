"""Read-only Ubuntu syntax check; files live only in a TemporaryDirectory."""
from pathlib import Path
import shutil
import subprocess
import tempfile
source=Path(__file__).resolve().parents[4]/"ops"
with tempfile.TemporaryDirectory(prefix="ritmo-probe-syntax-") as directory:
    root=Path(directory);units=[]
    for name in ("ritmo-monitor.service","ritmo-monitor.timer","ritmo-watchdog.service","ritmo-watchdog.timer"):
        target=root/name;shutil.copyfile(source/name,target);target.chmod(0o644);units.append(str(target))
    subprocess.run(["systemd-analyze","verify",*units],check=True)
    target=root/"sudoers";shutil.copyfile(source/"ritmo-probe.sudoers",target);target.chmod(0o440)
    subprocess.run(["/usr/sbin/visudo","-cf",str(target)],check=True)
    args=["ssh","-F","/dev/null","-G","-T"]
    for option in ("BatchMode=yes","StrictHostKeyChecking=yes","GlobalKnownHostsFile=/dev/null",
                   "IdentitiesOnly=yes","IdentityAgent=none","ClearAllForwardings=yes","ConnectTimeout=3",
                   "ConnectionAttempts=1","ServerAliveInterval=2","ServerAliveCountMax=1","UserKnownHostsFile=/dev/null"):
        args+=["-o",option]
    subprocess.run([*args,"ritmo-probe@10.80.0.2"],stdout=subprocess.DEVNULL,check=True)
print("ubuntu_probe_syntax_verified")
