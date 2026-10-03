import pathlib
import time
root=pathlib.Path('/var/lib/ritmo-jobs')
with (root/'entered').open('a') as stream: stream.write('x')
while not (root/'release').exists(): time.sleep(.05)
