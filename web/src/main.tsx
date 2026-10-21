import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useParams } from 'react-router';
import { liveQuery } from 'dexie';
import { ProbeDatabase, fixtures, type Lease, type Failure } from './store.ts';
import { pt } from './i18n/pt-BR.ts';
import { applyTheme } from './theme.ts';
import './style.css';

applyTheme();
const db = new ProbeDatabase();
type Snapshot = Awaited<ReturnType<ProbeDatabase['read']>>;

function FixtureRoute() {
  const { fixture } = useParams();
  if (fixture !== 'a' && fixture !== 'b') return <Navigate to="/probe/a" replace />;
  return <Probe key={fixture} fixture={fixture} />;
}

function Probe({ fixture }: { fixture: 'a' | 'b' }) {
  const account = fixtures[fixture].account;
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [lease, setLease] = useState<Lease>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cache, setCache] = useState(pt.cachePending as string);
  const [acquire, setAcquire] = useState<((steal: boolean) => void)>();

  useEffect(() => {
    let active = true;
    const releases = new Set<() => void>();
    const subscriptions: { unsubscribe(): void }[] = [];
    const claim = (steal: boolean) => {
      if (!navigator.locks) { setError(pt.unsupported); return; }
      setError('');
      void navigator.locks.request('ritmo-synthetic-probe-writer', steal ? { mode: 'exclusive', steal: true } : { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock || !active) return;
        const next = await db.claim(account);
        if (!active) return;
        setLease(next);
        await new Promise<void>(resolve => { releases.add(resolve); });
      }).catch((cause: unknown) => {
        if (!active) return;
        setLease(undefined);
        if (!(cause instanceof Error && cause.name === 'AbortError')) setError(pt.unavailable);
      });
    };
    void db.initialize().then(() => {
      if (!active) return;
      subscriptions.push(liveQuery(() => db.read(account)).subscribe({ next: value => { if (active) setSnapshot(value); }, error: () => { if (active) setError(pt.unavailable); } }));
      setAcquire(() => claim);
      claim(false);
    }).catch(() => { if (active) setError(pt.unavailable); });
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(() => { if (active) setCache(pt.cacheReady); }).catch(() => { if (active) setCache(pt.cacheFailed); });
    } else setCache(pt.cacheFailed);
    return () => { active = false; for (const release of releases) release(); for (const sub of subscriptions) sub.unsubscribe(); };
  }, [account]);

  const writer = Boolean(lease && snapshot?.control?.session_generation === lease.generation && snapshot.control.selected_account_id === account);
  async function toggle(habitId: string, failure: Failure) {
    if (!lease || busy) return;
    setBusy(true); setError('');
    try { await db.toggle(lease, habitId, failure); }
    catch (cause: unknown) {
      setError(cause instanceof Error && cause.name === 'QuotaExceededError' ? pt.failure : cause instanceof Error && cause.message === 'stale_writer' ? pt.stale : pt.unavailable);
    } finally { setBusy(false); }
  }
  const projection = snapshot?.projection;
  return <>
    <div className="proof-banner">{pt.proof}</div>
    <main>
      <div className="wordmark">{pt.brand}<span aria-hidden="true">.</span></div>
      <header>
        <p className="date">{pt.date}</p>
        <h1>{pt.greeting}</h1>
        <div className="xp-line"><span className="xp">{pt.xp(projection?.totalXp ?? 0)}</span><span className="mono">{pt.provisional}</span></div>
      </header>
      <div className="section-title"><h2>{pt.briefing}</h2><p>{pt.description}</p></div>
      <section className="habit-card" aria-label={pt.habits}>
        <div className="card-heading"><img src="/assets/habits.png" alt="" /><h3>{pt.habits}</h3></div>
        {!snapshot && <p>{pt.loading}</p>}
        {projection?.habits.map(habit => <div className="habit-row" key={habit.habitId}>
          <div className="tile" aria-hidden="true"><img src="/assets/habits.png" alt="" /></div>
          <span className="habit-title">{habit.title}</span>
          <button className="check-hit" role="checkbox" aria-checked={habit.done} aria-label={pt.habitAction(habit.title)} disabled={!writer || busy} onClick={() => void toggle(habit.habitId, 'none')}>
            <span className={`check ${habit.done ? 'done' : ''}`}>{habit.done && <img src="/assets/check.png" alt="" />}</span>
          </button>
        </div>)}
        {projection && <p className="progress">{pt.progress(projection.habits.filter(h => h.done).length, projection.habits.length)}</p>}
      </section>
      <div className="save-state" role="status"><p>{snapshot ? pt.pending(snapshot.pending.length) : pt.loading}</p><p>{snapshot && pt.saved}</p></div>
      <p className="durability">{pt.warning}</p>
    </main>
    <aside className="diagnostics" aria-label={pt.diagnostics}>
      <h2>{pt.diagnostics}</h2><p>{pt.noProduct}</p>
      <p data-testid="owner">{writer ? pt.owner : pt.reader}</p>
      <p data-testid="cache">{cache}</p>
      <nav><Link to="/probe/a">{pt.fixtureA}</Link><Link to="/probe/b">{pt.fixtureB}</Link></nav>
      {!writer && <button disabled={!acquire} onClick={() => acquire?.(true)}>{pt.takeover}</button>}
      <button disabled={!writer || busy || !projection?.habits[0]} onClick={() => { const habit = projection?.habits[0]; if (habit) void toggle(habit.habitId, 'quota'); }}>{pt.failButton}</button>
      {error && <p role="alert">{error}</p>}
      {!snapshot && error && <button onClick={() => window.location.reload()}>{pt.retry}</button>}
      <pre data-testid="diagnostic">{snapshot && JSON.stringify({ fixture, account, nextSequence: snapshot.nextSequence, totalXp: projection?.totalXp, operationIds: snapshot.pending.map(op => op.operationId), sequences: snapshot.pending.map(op => op.clientSequence), generation: snapshot.control?.session_generation }, null, 2)}</pre>
    </aside>
  </>;
}

createRoot(document.getElementById('root')!).render(<BrowserRouter><Routes><Route path="/probe/:fixture" element={<FixtureRoute />} /><Route path="*" element={<Navigate to="/probe/a" replace />} /></Routes></BrowserRouter>);
