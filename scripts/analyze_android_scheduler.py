"""Validate a local Perfetto trace and intersect JS scheduling with native-clock spans.

The Debug thread CPU counter is deliberately not used. Scheduled time is residency
on a guest vCPU, not proof of useful CPU work, host utilization or disk latency.
"""
import argparse
import csv
import gzip
import hashlib
import json
import math
import subprocess
from pathlib import Path


def intersect(intervals, start, end, require_coverage=False):
    assert end >= start
    pieces = sorted((max(start, a), min(end, b), state) for a, b, state in intervals if a < end and b > start)
    cursor = start
    totals = {}
    for a, b, state in pieces:
        assert a >= cursor, 'overlapping_scheduler_intervals'
        if require_coverage:
            assert a == cursor, 'scheduler_coverage_gap'
        totals[state] = totals.get(state, 0) + b - a
        cursor = b
    if require_coverage:
        assert cursor == end, 'scheduler_coverage_incomplete'
    assert sum(totals.values()) <= end - start
    return totals


def validate_clocks(rows):
    mono = [r for r in rows if r['clock_name'] == 'MONOTONIC']
    assert len(mono) >= 2 and all(int(r['ts']) == int(r['clock_value']) for r in mono), 'trace_not_native_monotonic'


def quantiles(values):
    ordered = sorted(values)
    assert ordered
    return dict(count=len(ordered), p50=ordered[math.ceil(len(ordered)*.5)-1],
                p95=ordered[math.ceil(len(ordered)*.95)-1], maximum=max(ordered), minimum=min(ordered))


def grouped_intervals(rows, state_key, last_by_pid):
    groups = {}
    for row in rows:
        pid, tid, ts, duration = (int(row[k]) for k in ['pid', 'tid', 'ts', 'dur'])
        if duration < 0:
            # Perfetto leaves terminal zombie/dead states open after force-stop.
            # They are irrelevant only when strictly after this PID's last frame.
            assert state_key == 'state' and row[state_key] in ('X', 'Z') and ts > last_by_pid[pid], 'unclosed_interval_overlaps_or_is_not_terminal'
            continue
        groups.setdefault((pid, tid), []).append((ts, ts + duration, row[state_key]))
    return groups


def summarize(rows, profiles):
    names = sorted({s['name'] for r in rows for s in r['spans']})
    sections = {name: {kind: quantiles([s[kind] for r in rows for s in r['spans'] if s['name'] == name])
                       for kind in ['wallMs', 'scheduledMs']} for name in names}
    days = {'toggle.day', 'refresh.day', 'refresh.nextDay'}
    day_totals = {kind: quantiles([sum(s[kind] for s in r['spans'] if s['name'] in days) for r in rows])
                  for kind in ['wallMs', 'scheduledMs']}
    def readings(r):
        return [r['start'], r['end']] + [a for s in r['spans'] for a in [s['start'], s['end']]]
    return dict(samples=len(rows), visual=quantiles([r['totalMs'] for r in rows]),
                within100ms=sum(r['totalMs'] <= 100 for r in rows),
                toggle={k: quantiles([r[k] for r in rows]) for k in ['wallMs', 'scheduledMs']},
                dayTotals=day_totals, sections=sections,
                observerRoundTripSumMs=quantiles([sum(v['jsAfterMs']-v['jsBeforeMs'] for v in readings(r)) for r in profiles]),
                observerRoundTripMaximumMs=max(v['jsAfterMs']-v['jsBeforeMs'] for r in profiles for v in readings(r)),
                threads=sorted({r['start']['thread'] for r in profiles}), worst=max(rows, key=lambda r: r['totalMs']))


def run(folder, processor=None, trace_override=None, verify_exports=False):
    processor_sha = 'adfa6bad3d72be3ba9b83fa2b17b69fa13b3ab1cad0f42e52b86188bd5f0f997'
    previous = json.loads((folder / 'scheduler-attribution.json').read_text(encoding='utf8')) if verify_exports else None
    if not verify_exports:
        assert processor and hashlib.sha256(processor.read_bytes()).hexdigest() == processor_sha, 'unverified_trace_processor'
        if trace_override:
            trace = trace_override
            assert trace.exists(), 'specified_trace_missing'
        else:
            trace = folder / 'scheduler.pftrace'
            if not trace.exists():
                trace = folder / 'scheduler.pftrace.gz'
        trace_bytes = gzip.decompress(trace.read_bytes()) if trace.suffix == '.gz' else trace.read_bytes()
        trace_sha = hashlib.sha256(trace_bytes).hexdigest()
    else:
        assert previous['traceProcessorSha256'] == processor_sha
        trace_sha = previous['traceSha256']
    profiles = json.loads((folder / 'toggle-profiles.json').read_text(encoding='utf-8-sig'))
    stages = json.loads((folder / 'toggle-attribution.json').read_text(encoding='utf-8-sig'))
    frames = json.loads((folder / 'native-frames.json').read_text(encoding='utf-8-sig'))
    assert len(profiles) == 20
    toggles = {(f['sample'], f['sequence']): f for f in frames if f['kind'] == 'toggle'}
    assert len(toggles) == 20
    pids = ','.join(str(int(f['pid'])) for f in frames if f['kind'] == 'startup')
    tids = ','.join(str(int(r['start']['tid'])) for r in profiles)
    first = min(int(f['inputNs']) for f in toggles.values())
    last = max(int(f['frameEndNs']) for f in toggles.values())
    where = f'p.pid IN ({pids}) AND (t.tid IN ({tids}) OR t.tid=p.pid)'
    queries = {
        'clocks': 'SELECT snapshot_id,ts,clock_id,clock_name,clock_value FROM clock_snapshot ORDER BY snapshot_id,clock_id',
        'stats': 'SELECT name,idx,severity,source,value FROM stats WHERE value != 0 ORDER BY name,idx',
        'bounds': 'SELECT start_ts,end_ts FROM trace_bounds',
        'threads': f'SELECT p.pid,t.tid,t.name,t.is_main_thread FROM thread t JOIN process p USING(upid) WHERE {where} ORDER BY p.pid,t.tid',
        'slices': f'SELECT p.pid,t.tid,s.ts,s.dur,s.cpu,s.end_state FROM sched_slice s JOIN thread t USING(utid) JOIN process p USING(upid) WHERE {where} AND s.ts < {last} AND s.ts+s.dur > {first} ORDER BY p.pid,t.tid,s.ts',
        'states': f'SELECT p.pid,t.tid,s.ts,s.dur,s.state,s.io_wait,s.blocked_function FROM thread_state s JOIN thread t USING(utid) JOIN process p USING(upid) WHERE {where} AND s.ts < {last} AND s.ts+s.dur > {first} ORDER BY p.pid,t.tid,s.ts',
    }
    export_files = ['native-frames.json', 'toggle-profiles.json', 'toggle-attribution.json', 'javascript-profiles.json', 'javascript-milestones.json'] + [f'scheduler-{name}.{extension}' for name in queries for extension in ['csv', 'sql']]
    if verify_exports:
        assert set(previous['exportsSha256']) == set(export_files), 'export_inventory_mismatch'
        for name in export_files:
            assert hashlib.sha256((folder / name).read_bytes()).hexdigest() == previous['exportsSha256'][name], 'export_changed: ' + name
    tables = {}
    for name, query in queries.items():
        if not verify_exports:
            (folder / f'scheduler-{name}.sql').write_text(query + ';\n', encoding='utf8', newline='\n')
            result = subprocess.run([str(processor), 'query', str(trace), query], capture_output=True, text=True, encoding='utf8', check=True)
            (folder / f'scheduler-{name}.csv').write_text(result.stdout, encoding='utf8', newline='\n')
        else:
            assert (folder / f'scheduler-{name}.sql').read_text(encoding='utf8') == query + ';\n', 'export_query_changed'
        tables[name] = list(csv.DictReader((folder / f'scheduler-{name}.csv').read_text(encoding='utf8').splitlines()))
    assert tables['clocks'], 'clock_snapshots_missing'
    validate_clocks(tables['clocks'])
    losses = [r for r in tables['stats'] if r['severity'] in ('data_loss', 'error') and int(r['value']) > 0]
    assert not losses, 'scheduler_trace_loss_or_error: ' + str(losses)
    bounds = tables['bounds'][0]
    assert int(bounds['start_ts']) <= first and int(bounds['end_ts']) >= last, 'trace_does_not_cover_cohort'
    last_by_pid = {f['pid']: max(v['frameEndNs'] for v in toggles.values() if v['pid'] == f['pid']) for f in toggles.values()}
    slices = grouped_intervals(tables['slices'], 'cpu', last_by_pid)
    states = grouped_intervals(tables['states'], 'state', last_by_pid)
    results = []
    def at(r):
        return round((r['beforeMs'] + r['afterMs']) * 500000)
    def measure_ns(key, a, b):
        assert key in states and key in slices, 'profile_thread_missing_in_trace'
        state = intersect(states[key], a, b, True)
        scheduled = sum(intersect(slices[key], a, b).values())
        assert scheduled == state.get('Running', 0), 'sched_and_thread_state_disagree'
        return dict(wallMs=(b-a)/1e6, scheduledMs=scheduled/1e6,
                    statesMs={s: n/1e6 for s, n in state.items()})
    for profile in profiles:
        frame = toggles[(profile['sample'], profile['sequence'])]
        key = (frame['pid'], profile['start']['tid'])
        ui_key = (frame['pid'], frame['pid'])
        assert any(int(r['pid']) == ui_key[0] and int(r['tid']) == ui_key[1] and r['is_main_thread'] == '1' for r in tables['threads']), 'ui_thread_identity_missing'
        def measure(start, end):
            return measure_ns(key, at(start), at(end))
        stage = next(r for r in stages if r['sample'] == profile['sample'] and r['sequence'] == profile['sequence'])
        handler = round(stage['handlerAtMs'] * 1e6)
        commit = round((stage['handlerAtMs'] + stage['handlerToCommitMs']) * 1e6)
        returned = round((stage['handlerAtMs'] + stage['handlerToCommitMs'] + stage['commitToReturnMs']) * 1e6)
        react = round(stage['reactAtMs'] * 1e6)
        points = [frame['inputNs'], frame['dispatchNs'], handler, commit, returned, react, frame['frameEndNs']]
        assert points == sorted(points)
        labels = ['eventToDispatch', 'dispatchToHandler', 'handlerToCommit', 'commitToReturn', 'returnToReact', 'reactToFrame']
        delivery = {name: {lane: measure_ns(tid, points[i], points[i+1]) for lane, tid in [('js', key), ('ui', ui_key)]}
                    for i, name in enumerate(labels)}
        results.append(dict(sample=profile['sample'], sequence=profile['sequence'], totalMs=(frame['frameEndNs']-frame['inputNs'])/1e6,
                            **measure(profile['start'], profile['end']),
                            delivery=delivery,
                            spans=[dict(name=s['name'], depth=s['depth'], **measure(s['start'], s['end'])) for s in profile['spans']]))
    output = dict(schema=1, validated=True, clock='MONOTONIC', source='sched_switch_and_thread_state',
                  traceSha256=trace_sha, traceProcessorSha256=processor_sha,
                  exportsSha256={name: hashlib.sha256((folder / name).read_bytes()).hexdigest() for name in export_files},
                  nativeCpuCounterUsed=False, scope='guest vCPU residency; not useful CPU time or host/disk attribution', rows=results)
    if verify_exports:
        assert output == previous, 'export_replay_differs_from_trace_analysis'
        assert summarize(results, profiles) == json.loads((folder / 'profile-summary.json').read_text(encoding='utf8')), 'export_summary_differs'
        print(json.dumps(dict(exportsVerified=True, samples=len(results), traceSha256=trace_sha)))
        return
    (folder / 'scheduler-attribution.json').write_text(json.dumps(output, indent=2) + '\n', encoding='utf8', newline='\n')
    (folder / 'profile-summary.json').write_text(json.dumps(summarize(results, profiles), indent=2) + '\n', encoding='utf8', newline='\n')
    print(json.dumps({k: v for k, v in output.items() if k != 'rows'}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('folder', type=Path)
    parser.add_argument('--processor', type=Path)
    parser.add_argument('--trace', type=Path)
    parser.add_argument('--verify-exports', action='store_true')
    args = parser.parse_args()
    run(args.folder.resolve(), args.processor.resolve() if args.processor else None,
        args.trace.resolve() if args.trace else None, args.verify_exports)
