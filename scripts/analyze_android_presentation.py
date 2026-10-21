"""Correlate the unchanged v4 gesture/frame with guest scheduling and native slices.

Sections can nest: their durations must not be added together. Scheduled time is
guest vCPU residency, never useful CPU work, host/GPU attribution or photons.
"""
import argparse
import csv
import gzip
import hashlib
import json
import subprocess
from pathlib import Path
from analyze_android_scheduler import grouped_intervals, intersect, quantiles, validate_clocks

PROCESSOR_SHA = 'adfa6bad3d72be3ba9b83fa2b17b69fa13b3ab1cad0f42e52b86188bd5f0f997'


def union(intervals):
    result = []
    for start, end in sorted(intervals):
        if result and start <= result[-1][1]:
            result[-1] = (result[-1][0], max(end, result[-1][1]))
        else:
            result.append((start, end))
    return result


def sections(rows, key, start, end, scheduled):
    groups = {}
    for row in rows:
        if (int(row['pid']), int(row['tid'])) != key:
            continue
        a, duration = int(row['ts']), int(row['dur'])
        if duration < 0:
            assert a >= end, 'unclosed_native_section_overlaps_measurement'
            continue
        b = a + duration
        if a < end and b > start:
            groups.setdefault(row['name'], []).append((max(a, start), min(b, end)))
    return sorted([dict(name=name, wallMs=sum(b-a for a, b in union(pieces))/1e6,
                        scheduledMs=sum(sum(intersect(scheduled, a, b).values())
                                        for a, b in union(pieces))/1e6)
                   for name, pieces in groups.items()], key=lambda r: r['wallMs'], reverse=True)


def analyze(tables, frames, stages):
    validate_clocks(tables['clocks'])
    assert not [r for r in tables['stats'] if r['severity'] in ('data_loss', 'error') and int(r['value']) > 0], 'trace_loss_or_error'
    raw = [f for f in frames if f['kind'] == 'toggle']
    assert len(raw) == 20, 'complete_cohort_required'
    assert all(f.get('schema') == 4 and f['downNs'] <= f['inputNs'] <= f['dispatchNs'] <= f['dispatchProbeEndNs'] <= f['drawNs'] <= f['frameEndNs'] for f in raw), 'gesture_frame_schema_or_order_invalid'
    toggles = {(f['sample'], f['sequence']): f for f in raw}
    assert len(toggles) == 20 and len(stages) == 20, 'complete_cohort_required'
    assert set(toggles) == {(r['sample'], r['sequence']) for r in stages}, 'stage_identity_mismatch'
    assert len({f['pid'] for f in toggles.values()}) == 10, 'ten_processes_required'
    bounds = tables['bounds'][0]
    assert int(bounds['start_ts']) <= min(f['inputNs'] for f in toggles.values()), 'trace_start_after_gesture'
    assert int(bounds['end_ts']) >= max(f['frameEndNs'] for f in toggles.values()), 'trace_end_before_frame'
    last = {f['pid']: max(v['frameEndNs'] for v in toggles.values() if v['pid'] == f['pid']) for f in toggles.values()}
    # Several short-lived threads inherit the RenderThread name during startup.
    # Select by the observed lifetime, never merge their CPU histories by name.
    roles_by_pid = {}
    for pid in last:
        first = min(f['inputNs'] for f in toggles.values() if f['pid'] == pid)
        threads = [r for r in tables['threads'] if int(r['pid']) == pid]
        active = []
        for thread in threads:
            if thread['name'] not in ('mqt_v_js', 'mqt_js', 'RenderThread') and thread['is_main_thread'] != '1':
                continue
            history = [r for r in tables['states'] if int(r['pid']) == pid and int(r['tid']) == int(thread['tid'])]
            assert history, 'named_thread_history_missing'
            began = min(int(r['ts']) for r in history)
            terminal = [int(r['ts']) for r in history if r['state'] in ('X', 'Z')]
            ended = min(terminal) if terminal else None
            if ended is not None and ended < first or began > last[pid]:
                continue  # proven outside both gestures, including startup's dead namesakes
            assert began <= first and (ended is None or ended >= last[pid]), 'thread_lifetime_changes_inside_frame_window'
            active.append(thread)
        js = [r for r in active if r['name'] in ('mqt_v_js', 'mqt_js')]
        assert len(js) == 1, 'javascript_thread_identity_missing_or_ambiguous'
        assert any(int(r['tid']) == pid and r['is_main_thread'] == '1' for r in active), 'main_thread_identity_missing'
        roles = {'js': (pid, int(js[0]['tid'])), 'ui': (pid, pid)}
        render = [r for r in active if r['name'] == 'RenderThread']
        assert len(render) <= 1, 'render_thread_ambiguous'
        if render:
            roles['render'] = (pid, int(render[0]['tid']))
        roles_by_pid[pid] = roles
    selected = {key for roles in roles_by_pid.values() for key in roles.values()}
    def relevant(rows):
        # A terminal or open state beginning after the last native frame has no
        # intersection with a measured interval. Open states within it still fail.
        return [r for r in rows if (int(r['pid']), int(r['tid'])) in selected and int(r['ts']) < last[int(r['pid'])]]
    states = grouped_intervals(relevant(tables['states']), 'state', last)
    sched = grouped_intervals(relevant(tables['sched']), 'cpu', last)
    output = []
    for stage in stages:
        frame = toggles[(stage['sample'], stage['sequence'])]
        pid = frame['pid']
        roles = roles_by_pid[pid]
        handler = round(stage['handlerAtMs']*1e6)
        commit = round((stage['handlerAtMs']+stage['handlerToCommitMs'])*1e6)
        returned = round((stage['handlerAtMs']+stage['handlerToCommitMs']+stage['commitToReturnMs'])*1e6)
        react = round(stage['reactAtMs']*1e6)
        points = [frame['inputNs'], frame['dispatchNs'], handler, commit, returned, react, frame['frameEndNs']]
        assert points == sorted(points), 'phase_clock_order_invalid'
        assert abs(stage['totalMs']-(points[-1]-points[0])/1e6) < 0.000002, 'stage_frame_clock_mismatch'
        labels = ['eventToDispatch', 'dispatchToHandler', 'handlerToCommit', 'commitToReturn', 'returnToReact', 'reactToFrame']
        def lane(key, start, end):
            assert key in states and key in sched, 'thread_history_missing'
            covered = intersect(states[key], start, end, True)
            scheduled = sum(intersect(sched[key], start, end).values())
            assert scheduled == covered.get('Running', 0), 'sched_thread_state_disagree'
            return dict(wallMs=(end-start)/1e6, scheduledMs=scheduled/1e6,
                        statesMs={name: value/1e6 for name, value in covered.items()},
                        sections=sections(tables['sections'], key, start, end, sched[key]))
        delivery = {label: {role: lane(key, points[i], points[i+1]) for role, key in roles.items()} for i, label in enumerate(labels)}
        # Native app sections are required, not inferred from another process.
        ui_sections = sections(tables['sections'], (pid, pid), points[0], points[-1], sched[(pid, pid)])
        assert any('doFrame' in r['name'] for r in ui_sections), 'native_app_frame_sections_missing'
        output.append(dict(sample=stage['sample'], sequence=stage['sequence'], pid=pid,
                           totalMs=(frame['frameEndNs']-frame['inputNs'])/1e6, jsTid=roles['js'][1], delivery=delivery))
    return output


def queries(frames):
    toggles = [f for f in frames if f['kind'] == 'toggle']
    pids = {int(f['pid']) for f in frames}
    where = 'p.pid IN ('+','.join(str(pid) for pid in sorted(pids))+')'
    lanes = where+" AND (t.is_main_thread=1 OR t.name IN ('mqt_v_js','mqt_js','RenderThread'))"
    windows = ' OR '.join('(p.pid='+str(int(f['pid']))+' AND s.ts<'+str(int(f['frameEndNs']))+' AND (s.dur<0 OR s.ts+s.dur>'+str(int(f['inputNs']))+'))' for f in toggles)
    thread = ' FROM thread t JOIN process p USING(upid) WHERE '+where
    return {
        'clocks': 'SELECT ts,clock_id,clock_value,clock_name FROM clock_snapshot ORDER BY ts,clock_id',
        'stats': 'SELECT name,severity,value FROM stats ORDER BY name',
        'bounds': 'SELECT start_ts,end_ts FROM trace_bounds',
        'threads': 'SELECT p.pid,t.tid,t.name,t.is_main_thread'+thread,
        'sched': 'SELECT p.pid,t.tid,s.ts,s.dur,s.cpu FROM sched_slice s JOIN thread t USING(utid) JOIN process p USING(upid) WHERE '+lanes+' ORDER BY t.tid,s.ts',
        'states': 'SELECT p.pid,t.tid,s.ts,s.dur,s.state FROM thread_state s JOIN thread t USING(utid) JOIN process p USING(upid) WHERE '+lanes+' ORDER BY t.tid,s.ts',
        'sections': 'SELECT p.pid,t.tid,s.id,s.ts,s.dur,s.depth,s.name FROM slice s JOIN thread_track tt ON s.track_id=tt.id JOIN thread t ON tt.utid=t.utid JOIN process p USING(upid) WHERE '+where+' AND ('+windows+') ORDER BY t.tid,s.ts,s.depth',
    }


def run(folder, processor, verify=False, trace_override=None):
    previous = json.loads((folder/'presentation-attribution.json').read_text(encoding='utf8')) if verify else None
    frames = json.loads((folder/'native-frames.json').read_text(encoding='utf8'))
    stages = json.loads((folder/'toggle-attribution.json').read_text(encoding='utf8'))
    mode = json.loads((folder/'observation-mode.json').read_text(encoding='utf8'))
    assert mode == dict(mode='lightweight', probe=4, synchronousClock=False, schedulerTrace=True, presentationTrace=True, validated=True), 'presentation_observation_mismatch'
    assert json.loads((folder/'javascript-profiles.json').read_text(encoding='utf8')) == [], 'synchronous_profile_unexpected'
    sql = queries(frames)
    exports = ['native-frames.json', 'toggle-attribution.json', 'javascript-milestones.json', 'javascript-profiles.json', 'observation-mode.json']
    exports += ['presentation-'+name+'.'+ext for name in sql for ext in ['sql', 'csv']]
    if verify:
        assert previous['traceProcessorSha256'] == PROCESSOR_SHA
        assert set(previous['exportsSha256']) == set(exports), 'export_inventory_changed'
        for name in exports:
            assert hashlib.sha256((folder/name).read_bytes()).hexdigest() == previous['exportsSha256'][name], 'export_changed_'+name
        trace_sha = previous['traceSha256']
    else:
        assert processor and hashlib.sha256(processor.read_bytes()).hexdigest() == PROCESSOR_SHA, 'unverified_trace_processor'
        path = trace_override if trace_override else folder/'scheduler.pftrace'
        if not trace_override and not path.exists():
            path = folder/'scheduler.pftrace.gz'
        trace_bytes = gzip.decompress(path.read_bytes()) if path.suffix == '.gz' else path.read_bytes()
        trace_sha = hashlib.sha256(trace_bytes).hexdigest()
    tables = {}
    for name, query in sql.items():
        if verify:
            assert (folder/('presentation-'+name+'.sql')).read_text(encoding='utf8') == query+';\n', 'query_changed'
        else:
            (folder/('presentation-'+name+'.sql')).write_text(query+';\n', encoding='utf8', newline='\n')
            result = subprocess.run([str(processor), 'query', str(path), query], capture_output=True, text=True, encoding='utf8', check=True)
            (folder/('presentation-'+name+'.csv')).write_text(result.stdout, encoding='utf8', newline='\n')
        tables[name] = list(csv.DictReader((folder/('presentation-'+name+'.csv')).read_text(encoding='utf8').splitlines()))
    rows = analyze(tables, frames, stages)
    output = dict(schema=1, validated=True, clock='MONOTONIC', source='sched_switch_thread_state_and_native_slices',
                  scope='guest vCPU residency; nested sections are not additive; no JS component, GPU or host attribution',
                  traceSha256=trace_sha, traceProcessorSha256=PROCESSOR_SHA,
                  exportsSha256={name: hashlib.sha256((folder/name).read_bytes()).hexdigest() for name in exports}, rows=rows)
    summary = dict(samples=len(rows), visual=quantiles([r['totalMs'] for r in rows]), within100ms=sum(r['totalMs'] <= 100 for r in rows),
                   reactToFrame={role: {kind: quantiles([r['delivery']['reactToFrame'][role][kind] for r in rows]) for kind in ['wallMs', 'scheduledMs']} for role in ['js', 'ui']},
                   worst=max(rows, key=lambda r: r['totalMs']))
    if verify:
        assert output == previous, 'export_replay_differs'
        assert summary == json.loads((folder/'presentation-summary.json').read_text(encoding='utf8')), 'summary_replay_differs'
    else:
        (folder/'presentation-attribution.json').write_text(json.dumps(output, indent=2)+'\n', encoding='utf8', newline='\n')
        (folder/'presentation-summary.json').write_text(json.dumps(summary, indent=2)+'\n', encoding='utf8', newline='\n')
    print(json.dumps(dict(verified=True, replay=verify, samples=len(rows), within100ms=summary['within100ms'], visual=summary['visual'], traceSha256=trace_sha)))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('folder', type=Path)
    parser.add_argument('--processor', type=Path)
    parser.add_argument('--trace', type=Path)
    parser.add_argument('--verify-exports', action='store_true')
    args = parser.parse_args()
    run(args.folder.resolve(), args.processor.resolve() if args.processor else None, args.verify_exports,
        args.trace.resolve() if args.trace else None)
