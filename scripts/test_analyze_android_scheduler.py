import unittest
from analyze_android_scheduler import intersect, validate_clocks, quantiles, grouped_intervals


class SchedulerIntervals(unittest.TestCase):
    def test_clip_and_cover_a_span_across_run_queue_and_sleep(self):
        intervals = [(0, 10, 'Running'), (10, 20, 'R'), (20, 30, 'S'), (30, 40, 'Running')]
        self.assertEqual(intersect(intervals, 5, 35, True), {'Running': 10, 'R': 10, 'S': 10})

    def test_overlapping_execution_on_two_virtual_cpus_is_not_double_counted(self):
        with self.assertRaisesRegex(AssertionError, 'overlapping'):
            intersect([(0, 15, 'cpu0'), (10, 20, 'cpu1')], 5, 18)

    def test_missing_scheduler_history_cannot_be_called_waiting(self):
        for intervals in [[(0, 10, 'Running'), (11, 30, 'S')], [(0, 29, 'Running')], []]:
            with self.assertRaises(AssertionError):
                intersect(intervals, 5, 30, True)

    def test_another_primary_clock_or_constant_offset_is_not_native_monotonic(self):
        valid = [dict(clock_name='MONOTONIC', ts=n, clock_value=n) for n in [100, 200]]
        validate_clocks(valid)
        for rows in [[], valid[:1], [dict(r, clock_name='BOOTTIME') for r in valid], [dict(r, ts=r['ts']+1) for r in valid]]:
            with self.assertRaisesRegex(AssertionError, 'trace_not_native_monotonic'):
                validate_clocks(rows)

    def test_quantiles_use_nearest_rank_instead_of_averaging_the_middle_pair(self):
        self.assertEqual(quantiles(range(1, 21)), dict(count=20, p50=10, p95=19, maximum=20, minimum=1))

    def test_only_terminal_states_after_the_pids_last_frame_may_remain_open(self):
        row = dict(pid='1', tid='2', ts='101', dur='-1', state='X')
        self.assertEqual(grouped_intervals([row], 'state', {1: 100}), {})
        for patch in [dict(ts='99'), dict(ts='100'), dict(state='Running'), dict(state='S')]:
            with self.assertRaisesRegex(AssertionError, 'unclosed_interval'):
                grouped_intervals([dict(row, **patch)], 'state', {1: 100})


if __name__ == '__main__':
    unittest.main()
