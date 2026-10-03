"""External finite process fixture for native schedule evidence."""
from datetime import datetime,timezone
import json
from pathlib import Path
path=Path("/srv/ritmo-monitor/state.json")
path.write_text(json.dumps({"version":1,"checked":datetime.now(timezone.utc).isoformat(),"reported":{},"consecutive":{}}))
path.chmod(0o600)
