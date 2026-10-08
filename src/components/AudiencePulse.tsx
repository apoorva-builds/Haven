import type { AudienceSeries } from '../data/types';
import { changeOver, formatAge, formatCount, formatSigned, freshness, latestSnapshot, trend, type Change } from '../lib/audience';
import { accountOf } from '../state/selectors';
import { useStore } from '../state/store';
import { InfoButton } from './InfoButton';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** 30-day trend. Static — it never animates as if live. */
function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;
  const w = 132;
  const h = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 6) + 3, h - 4 - ((v - min) / span) * (h - 8)] as const);
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <title>{label}</title>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="spark__line" />
      <circle cx={last[0]} cy={last[1]} r="4" className="spark__dot" />
    </svg>
  );
}

function Delta({ change, label }: { change: Change | null; label: string }) {
  if (!change) {
    return (
      <div className="pulse__delta">
        <span className="pulse__delta-label">{label}</span>
        <span className="muted">Not enough history</span>
      </div>
    );
  }
  const dir = change.delta > 0 ? 'up' : change.delta < 0 ? 'down' : 'flat';
  return (
    <div className="pulse__delta" data-testid={`delta-${change.days}`}>
      <span className="pulse__delta-label">{label}</span>
      <span className={`pulse__delta-value pulse__delta-value--${dir}`}>
        {dir !== 'flat' && <span className="pulse__arrow" aria-hidden="true">{dir === 'up' ? '▲' : '▼'}</span>}
        {formatSigned(change.delta)} <span className="muted">({(change.ratio * 100).toFixed(1)}%)</span>
      </span>
    </div>
  );
}

/**
 * Compact audience summary for one account. All figures in the preview are
 * samples. A count older than the series' stale window is shown as
 * "Out of date", never as the current number.
 */
export function AudiencePulse({ accountId }: { accountId: string }) {
  const { data } = useStore();
  const account = accountOf(data, accountId);
  const series: AudienceSeries | undefined = data.audience.find((s) => s.accountId === accountId);
  if (!account) return null;
  const latest = series && latestSnapshot(series);
  const fresh = series ? freshness(series) : undefined;
  const metric = series?.metric ?? 'followers';

  return (
    <section className="pulse" aria-labelledby="pulse-h" data-testid="audience-pulse">
      <div className="pulse__head">
        <h2 id="pulse-h" className="pulse__title">
          Audience Pulse
        </h2>
        <InfoButton k="pulse" />
        {latest && fresh && (
          <span className="pulse__updated">
            Last updated <time dateTime={latest.at}>{when(latest.at)}</time> · {formatAge(fresh.ageMs)}
          </span>
        )}
      </div>

      {!series || !latest || !fresh ? (
        <p className="muted">No audience snapshots yet.</p>
      ) : fresh.stale ? (
        <div className="pulse__body pulse__body--stale" data-testid="pulse-stale">
          <div className="pulse__main">
            <p className="pulse__value pulse__value--stale">Out of date</p>
            <p className="pulse__metric">
              Last known: {formatCount(latest.count)} {metric} (sample), {formatAge(fresh.ageMs)}. {series.source.kind === 'sample' && series.source.plannedUpdate === 'manual' ? 'Add a new snapshot to show a current count.' : 'Waiting for a fresh update.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="pulse__body">
          <div className="pulse__main">
            <p className="pulse__value" data-testid="pulse-count">
              {formatCount(latest.count)}
            </p>
            <p className="pulse__metric">
              {metric} · <span data-testid="pulse-sample">sample</span>
            </p>
          </div>
          <Delta change={changeOver(series, 7)} label="7 days" />
          <Delta change={changeOver(series, 30)} label="30 days" />
          <Sparkline values={trend(series, 30)} label={`30-day ${metric} trend (sample), from ${formatCount(trend(series, 30)[0])} to ${formatCount(latest.count)}`} />
        </div>
      )}
    </section>
  );
}
