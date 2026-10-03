"""Read-only finite primary metadata. No connection or process starts on import."""
import json
from pathlib import Path
import re
import shutil
import stat
from probe_transport import bounded_process, config
from receiver import trusted

CONFIG=Path("/etc/ritmo/primary.json")
QUERY="""
SELECT json_build_object(
 'systemIdentifier',(pg_control_system()).system_identifier::text,
 'database',NOT pg_is_in_recovery() AND current_setting('server_version_num')::int BETWEEN 180000 AND 189999,
 'durable',current_setting('fsync')='on' AND current_setting('full_page_writes')='on'
     AND current_setting('wal_level')='replica' AND current_setting('synchronous_commit')='on'
     AND current_setting('synchronous_standby_names')='FIRST 1 (ritmo_wal)',
 'slot',json_build_object(
   'present',s.slot_name IS NOT NULL,'active',COALESCE(s.active,false),
   'healthy',COALESCE(s.slot_type='physical' AND NOT s.temporary AND s.active
       AND s.restart_lsn IS NOT NULL AND s.wal_status IN ('reserved','extended') AND s.invalidation_reason IS NULL,false),
   'invalidated',s.invalidation_reason IS NOT NULL,'status',s.wal_status,
   'retainedBytes',CASE WHEN NOT pg_is_in_recovery() AND s.restart_lsn IS NOT NULL
       THEN pg_wal_lsn_diff(pg_current_wal_lsn(),s.restart_lsn)::bigint ELSE NULL END))
FROM (SELECT 1) AS anchor LEFT JOIN pg_replication_slots s ON s.slot_name='ritmo_wal'
"""

def directory(path: Path, uid: int) -> Path:
    if not path.is_absolute() or any(p.is_symlink() for p in (path,*path.parents)): raise ValueError("primary_requires_resolved_directory")
    for item in (path,*path.parents):
        info=item.stat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid not in (0,uid) or info.st_mode & 0o022:
            raise ValueError("primary_requires_protected_directory")
    if path.stat().st_uid!=uid: raise ValueError("primary_directory_owner_mismatch")
    return path

def collect() -> dict:
    values=config(CONFIG)
    if set(values)!={"dataPath","walPath","dataOwnerUid","binaryDir","environmentFile"}: raise ValueError("invalid_primary_config")
    uid=values["dataOwnerUid"]
    if type(uid) is not int or uid<1: raise ValueError("invalid_primary_owner")
    data=directory(Path(values["dataPath"]),uid)
    wal=directory(Path(values["walPath"]),uid)
    if (data/"pg_wal").resolve(strict=True)!=wal: raise ValueError("primary_wal_mount_mismatch")
    version=data/"PG_VERSION";info=version.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid!=uid or info.st_mode & 0o022 or info.st_size>8 or version.read_text().strip()!="18":
        raise ValueError("primary_requires_pg18")
    binary=trusted(Path(values["binaryDir"]),directory=True)
    control=trusted(binary/"pg_controldata");psql=trusted(binary/"psql")
    output=bounded_process([str(control),str(data)],3,isolated=False).decode("utf-8")
    match=re.search(r"^Database system identifier:\s*(\d+)\s*$",output,re.MULTILINE)
    if not match: raise ValueError("primary_control_identity_missing")
    storage={}
    for name,path in (("data",data),("wal",wal)):
        disk=shutil.disk_usage(path)
        if disk.total<=0: raise ValueError("invalid_primary_filesystem")
        storage[name]=100*(disk.total-disk.free)/disk.total
    environment=config(Path(values["environmentFile"]))
    required={"PGHOST","PGPORT","PGDATABASE","PGUSER","PGAPPNAME","PGSSLMODE","PGSSLROOTCERT","PGPASSFILE"}
    if not required<=set(environment) or set(environment)-required-{"PGCONNECT_TIMEOUT"} or any(not isinstance(v,str) or not v or "\0" in v for v in environment.values()):
        raise ValueError("invalid_primary_environment")
    if environment["PGUSER"]!="ritmo_primary_probe" or environment["PGAPPNAME"]!="ritmo_primary_probe" or environment["PGSSLMODE"]!="verify-full":
        raise ValueError("primary_requires_readonly_identity_and_tls")
    if not re.fullmatch(r"[A-Za-z0-9_.:-]+",environment["PGHOST"]) or not environment["PGPORT"].isdigit() or not 1<=int(environment["PGPORT"])<=65535:
        raise ValueError("invalid_primary_destination")
    if environment.get("PGCONNECT_TIMEOUT","2") not in ("1","2"): raise ValueError("invalid_primary_deadline")
    trusted(Path(environment["PGSSLROOTCERT"]))
    secret=trusted(Path(environment["PGPASSFILE"]))
    if secret.stat().st_mode & 0o077: raise ValueError("primary_requires_private_passfile")
    env={"PATH":"/usr/bin:/bin","LC_ALL":"C",**environment,"PGCONNECT_TIMEOUT":environment.get("PGCONNECT_TIMEOUT","2"),
         "PGOPTIONS":"-c default_transaction_read_only=on -c statement_timeout=1500 -c lock_timeout=500"}
    try:
        response=json.loads(bounded_process([str(psql),"--no-password","-XAt","-v","ON_ERROR_STOP=1","-c",QUERY],
            3,isolated=False,environment=env).decode("utf-8"))
    except (OSError,ValueError,RuntimeError):
        return {"database":False,"durable":None,"slot":None,"storage":storage}
    if response.pop("systemIdentifier")!=match.group(1): raise ValueError("primary_cluster_mismatch")
    if not response["database"]: response.update(durable=None,slot=None)
    return {**response,"storage":storage}
