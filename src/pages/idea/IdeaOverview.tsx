import { Link } from 'react-router-dom';
import type { Idea } from '../../data/types';
import { Icon } from '../../components/Icon';
import { AccountBadge, Avatar, ExternalLink, StatusPill } from '../../components/ui';
import { formatDay } from '../../lib/dates';
import { accountOf, checklistProgress, personOf, versionsForIdea } from '../../state/selectors';
import { useStore } from '../../state/store';

export function IdeaOverview({ idea }: { idea: Idea }) {
  const { data, dispatch, allowed } = useStore();
  const versions = versionsForIdea(data, idea.id);
  const campaign = data.campaigns.find((c) => c.id === idea.campaignId);
  const liveLinks = versions.filter((v) => v.liveUrl);
  const shotsDone = idea.shotList.filter((s) => s.done).length;

  return (
    <div className="overview">
      <div className="overview__main">
        <section className="card prose-card" aria-labelledby="concept-h">
          <h2 id="concept-h" className="h3">
            Concept
          </h2>
          {idea.concept ? <p className="prose">{idea.concept}</p> : <p className="muted">No concept written yet.</p>}
        </section>

        <section className="card prose-card" aria-labelledby="script-h">
          <h2 id="script-h" className="h3">
            Script
          </h2>
          {idea.script ? <pre className="script">{idea.script}</pre> : <p className="muted">No script yet. Scripts are optional — some ideas are pure shot lists.</p>}
        </section>

        <section className="card" aria-labelledby="shots-h">
          <div className="card__head">
            <h2 id="shots-h" className="h3">
              Shot list
            </h2>
            {idea.shotList.length > 0 && (
              <span className="muted">
                {shotsDone} of {idea.shotList.length} captured
              </span>
            )}
          </div>
          {idea.shotList.length === 0 ? (
            <p className="muted">No shots planned yet.</p>
          ) : (
            <ul className="checklist">
              {idea.shotList.map((s) => (
                <li key={s.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={s.done}
                      disabled={!allowed({ type: 'idea/shot-toggle', ideaId: idea.id, shotId: s.id })}
                      onChange={() => dispatch({ type: 'idea/shot-toggle', ideaId: idea.id, shotId: s.id })}
                    />
                    <span>{s.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="overview__side">
        <section className="card" aria-labelledby="versions-h">
          <div className="card__head">
            <h2 id="versions-h" className="h3">
              Versions
            </h2>
            <Link to={`/ideas/${idea.id}/versions`} className="text-link">
              Open <Icon name="arrowRight" size={14} />
            </Link>
          </div>
          {versions.length === 0 ? (
            <p className="muted">No versions yet. Plan one per account from the Versions tab.</p>
          ) : (
            <ul className="mini-versions">
              {versions.map((v) => {
                const account = accountOf(data, v.accountId)!;
                const { done, total } = checklistProgress(v);
                return (
                  <li key={v.id}>
                    <Link to={`/ideas/${idea.id}/versions?v=${v.id}`}>
                      <AccountBadge account={account} showHandle />
                      <span className="muted">
                        {v.format} · {formatDay(v.scheduledFor)} · {done}/{total}
                      </span>
                      <StatusPill status={v.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="details-h">
          <h2 id="details-h" className="h3">
            Details
          </h2>
          <dl className="details">
            <dt>Campaign</dt>
            <dd>{campaign ? <Link to={`/campaigns#${campaign.id}`}>{campaign.name}</Link> : '—'}</dd>
            <dt>Series</dt>
            <dd>{idea.series ?? '—'}</dd>
            <dt>People</dt>
            <dd className="people">
              {idea.peopleIds.map((id) => {
                const p = personOf(data, id);
                return p ? (
                  <span key={id} className="person">
                    <Avatar person={p} size={24} /> {p.name}
                    <span className="muted">{p.role}</span>
                  </span>
                ) : null;
              })}
            </dd>
          </dl>
        </section>

        <section className="card" aria-labelledby="refs-h">
          <h2 id="refs-h" className="h3">
            References
          </h2>
          {idea.references.length === 0 ? (
            <p className="muted">No references saved.</p>
          ) : (
            <ul className="plain-list">
              {idea.references.map((r) => (
                <li key={r.id}>
                  <ExternalLink href={r.url}>{r.label}</ExternalLink>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="history-h">
          <h2 id="history-h" className="h3">
            Live links &amp; learning
          </h2>
          {liveLinks.length === 0 ? (
            <p className="muted">Nothing posted yet. Add the live URL on a version after you post it natively.</p>
          ) : (
            <ul className="plain-list">
              {liveLinks.map((v) => (
                <li key={v.id}>
                  <ExternalLink href={v.liveUrl!}>
                    {accountOf(data, v.accountId)?.handle} · {v.format}
                  </ExternalLink>
                </li>
              ))}
            </ul>
          )}
          {idea.learningNotes && <p className="note">“{idea.learningNotes}”</p>}
        </section>
      </aside>
    </div>
  );
}
