import copy
import unittest
from analyze_android_presentation import analyze, sections


def fixture():
    tables = dict(clocks=[dict(clock_name='MONOTONIC', ts=n, clock_value=n) for n in [1, 100000000000]],
                  stats=[], bounds=[dict(start_ts=1, end_ts=100000000000)], threads=[], sched=[], states=[], sections=[])
    frames, stages = [], []
    for sample in range(1, 11):
        pid, base = sample, sample*1000000000
        for tid, name, main in [(pid, 'app', '1'), (pid+100, 'mqt_v_js', '0')]:
            tables['threads'].append(dict(pid=pid, tid=tid, name=name, is_main_thread=main))
            tables['sched'].append(dict(pid=pid, tid=tid, ts=base, dur=600000000, cpu='0'))
            tables['states'].append(dict(pid=pid, tid=tid, ts=base, dur=600000000, state='Running'))
        for sequence in [1, 2]:
            start = base+(sequence-1)*300000000
            frames.append(dict(kind='toggle', sample=sample, sequence=sequence, pid=pid, schema=4,
                               downNs=start-1000000, inputNs=start, dispatchNs=start+1000000,
                               dispatchProbeEndNs=start+1500000, drawNs=start+134000000, frameEndNs=start+135000000))
            stages.append(dict(sample=sample, sequence=sequence, handlerAtMs=start/1e6+5,
                               handlerToCommitMs=10, commitToReturnMs=10,
                               reactAtMs=start/1e6+35, totalMs=135))
            tables['sections'].append(dict(pid=pid, tid=pid, name='Choreographer#doFrame', ts=start+30000000, dur=105000000))
    return tables, frames, stages


class PresentationIntervals(unittest.TestCase):
    def test_real_identity_and_two_lanes_are_correlated_to_the_same_frame(self):
        tables, frames, stages = fixture()
        rows = analyze(tables, frames, stages)
        self.assertEqual(len(rows), 20)
        self.assertEqual(rows[-1]['jsTid'], 110)
        for role in ['js', 'ui']:
            self.assertEqual(rows[0]['delivery']['reactToFrame'][role]['scheduledMs'], 100)
        self.assertEqual(rows[0]['delivery']['reactToFrame']['ui']['sections'][0]['wallMs'], 100)

    def test_nested_sections_do_not_double_count_one_named_section_or_other_threads(self):
        rows = [dict(pid=1, tid=1, name='mount', ts=0, dur=20),
                dict(pid=1, tid=1, name='mount', ts=5, dur=5),
                dict(pid=1, tid=2, name='mount', ts=0, dur=20)]
        result = sections(rows, (1, 1), 2, 18, [(0, 10, '0')])
        self.assertEqual(result, [dict(name='mount', wallMs=16e-6, scheduledMs=8e-6)])

    def test_missing_or_ambiguous_js_thread_and_foreign_native_sections_are_rejected(self):
        tables, frames, stages = fixture()
        for patch in ['missing', 'ambiguous', 'foreign']:
            changed = copy.deepcopy(tables)
            if patch == 'missing':
                changed['threads'] = [r for r in changed['threads'] if r['tid'] != 101]
            elif patch == 'ambiguous':
                changed['threads'].append(dict(pid=1, tid=999, name='mqt_js', is_main_thread='0'))
            else:
                for row in changed['sections']:
                    if row['pid'] == 1:
                        row['pid'] = 999
            with self.assertRaises(AssertionError):
                analyze(changed, frames, stages)

    def test_clock_offset_losses_and_late_trace_cannot_produce_a_valid_profile(self):
        tables, frames, stages = fixture()
        for patch in ['clock', 'loss', 'start', 'end']:
            changed = copy.deepcopy(tables)
            if patch == 'clock':
                changed['clocks'][0]['ts'] += 1
            elif patch == 'loss':
                changed['stats'] = [dict(name='ftrace_cpu_overrun', severity='data_loss', value=1)]
            elif patch == 'start':
                changed['bounds'][0]['start_ts'] = frames[0]['inputNs']+1
            else:
                changed['bounds'][0]['end_ts'] = frames[-1]['frameEndNs']-1
            with self.assertRaises(AssertionError):
                analyze(changed, frames, stages)

    def test_scheduler_gaps_and_cpu_disagreement_do_not_become_idle_time(self):
        tables, frames, stages = fixture()
        for patch in ['gap', 'mismatch']:
            changed = copy.deepcopy(tables)
            if patch == 'gap':
                changed['states'][0]['ts'] += 1
                changed['states'][0]['dur'] -= 1
            else:
                changed['states'][0]['state'] = 'S'
            with self.assertRaises(AssertionError):
                analyze(changed, frames, stages)

    def test_no_partial_cohort_or_changed_endpoint(self):
        tables, frames, stages = fixture()
        with self.assertRaisesRegex(AssertionError, 'complete_cohort'):
            analyze(tables, frames[:-1], stages)
        changed = copy.deepcopy(stages)
        changed[0]['totalMs'] = 100
        with self.assertRaisesRegex(AssertionError, 'stage_frame_clock_mismatch'):
            analyze(tables, frames, changed)
        with self.assertRaisesRegex(AssertionError, 'complete_cohort'):
            analyze(tables, frames+[frames[0]], stages)

    def test_the_integer_frame_endpoint_decides_the_limit_without_rounding_down(self):
        tables, frames, stages = fixture()
        frames[0]['frameEndNs'] = frames[0]['inputNs']+100000001
        frames[0]['drawNs'] = frames[0]['frameEndNs']-1
        stages[0]['totalMs'] = 100  # floating-point stages cannot round the endpoint into acceptance
        self.assertGreater(analyze(tables, frames, stages)[0]['totalMs'], 100)

    def test_startups_dead_namesakes_and_states_after_the_last_frame_are_outside_the_measurement(self):
        tables, frames, stages = fixture()
        base = frames[0]['inputNs']
        tables['threads'].append(dict(pid=1, tid=999, name='RenderThread', is_main_thread='0'))
        tables['states'].extend([dict(pid=1, tid=999, ts=base-1000, dur=500, state='Running'), dict(pid=1, tid=999, ts=base-500, dur=-1, state='X')])
        tables['sched'].append(dict(pid=1, tid=999, ts=base-1000, dur=500, cpu='0'))
        tables['states'].append(dict(pid=1, tid=1, ts=base+600000000, dur=-1, state='S'))
        self.assertEqual(len(analyze(tables, frames, stages)), 20)
        changed = copy.deepcopy(tables)
        changed['states'][0]['dur'] = -1
        changed['states'][0]['state'] = 'S'
        with self.assertRaisesRegex(AssertionError, 'unclosed_interval'):
            analyze(changed, frames, stages)


if __name__ == '__main__':
    unittest.main()
