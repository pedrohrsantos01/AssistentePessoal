"""Controlled remote process boundary, never installed outside this test fixture."""
import os
from pathlib import Path
import time
mode=Path("/opt/fixture/payload-mode").read_text()
if mode=="overflow":
    os.write(1,b"x"*300000)
elif mode=="timeout":
    time.sleep(20)
else:
    os.write(1,mode.encode())
