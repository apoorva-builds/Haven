import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Cover } from '../components/Cover';
import { EmptyState, PageHeader, StatusPill } from '../components/ui';
import { formatDay } from '../lib/dates';
import { useStore } from '../state/store';

export function CampaignsPage() {
  const { data } = useStore();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <div className="page">
      <PageHeader eyebrow="Campaigns" title="Launches, series and partners" lede="A campaign groups ideas for one purpose. Its dates and colour carry into the marketing calendar." />
      {data.campaigns.length === 0 ? (
        <EmptyState icon="campaigns" title="No campaigns yet" />
      ) : (
        <div className="campaigns">
          {data.campaigns.map((c) => {
            const ideas = data.ideas.filter((i) => i.campaignId === c.id && !i.archived);
            const versions = data.versions.filter((v) => ideas.some((i) => i.id === v.ideaId));
            const posted = versions.filter((v) => v.status === 'Posted').length;
            return (
              <section key={c.id} id={c.id} className={`campaign ${hash === `#${c.id}` ? 'is-target' : ''}`} style={{ ['--hue' as string]: c.hue }} aria-labelledby={`c-${c.id}`}>
                <header className="campaign__head">
                  <span className="tag tag--hue">{c.kind}</span>
                  <h2 id={`c-${c.id}`} className="h2">
                    {c.name}
                  </h2>
                  <p className="muted">
                    {formatDay(c.start)} – {formatDay(c.end)} · {ideas.length} idea{ideas.length === 1 ? '' : 's'} · {versions.length} versions · {posted} posted
                  </p>
                  <p>{c.summary}</p>
                  <Link className="text-link" to={`/calendar?view=marketing&campaign=${c.id}`}>
                    Marketing calendar →
                  </Link>
                </header>
                <div className="campaign__ideas">
                  {ideas.map((i) => (
                    <Link key={i.id} to={`/ideas/${i.id}`} className="strip__item">
                      <Cover art={i.art} ratio="4 / 3" />
                      <span className="strip__title">{i.title}</span>
                      <StatusPill status={i.status} />
                    </Link>
                  ))}
                  {ideas.length === 0 && <p className="muted">No active ideas in this campaign.</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
