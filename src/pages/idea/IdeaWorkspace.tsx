import { useCallback, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { IDEA_STATUSES, type IdeaStatus } from '../../data/types';
import { Cover } from '../../components/Cover';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { AvatarStack, DemoTag, EmptyState, Skeleton, useDismiss, useSimulatedLoad } from '../../components/ui';
import { formatDay, relativeDay } from '../../lib/dates';
import { assetsForIdea, ideaOf, personOf, tasksForIdea, versionsForIdea } from '../../state/selectors';
import { useStore } from '../../state/store';
import { IdeaAssets } from './IdeaAssets';
import { IdeaOverview } from './IdeaOverview';
import { IdeaTasks } from './IdeaTasks';
import { IdeaVersions } from './IdeaVersions';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'assets', label: 'Assets' },
  { key: 'versions', label: 'Versions' },
  { key: 'tasks', label: 'Tasks' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function IdeaWorkspacePage() {
  const { ideaId = '', tab = 'overview' } = useParams();
  const { data, dispatch } = useStore();
  const ready = useSimulatedLoad(300);
  const idea = ideaOf(data, ideaId);
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  const menuRef = useDismiss<HTMLDivElement>(menu, closeMenu);
  const toast = useToast();
  const navigate = useNavigate();

  if (!idea) {
    return (
      <div className="page">
        <EmptyState icon="ideas" title="This idea isn’t here" action={<Link className="btn btn--primary" to="/ideas">Back to Ideas</Link>}>
          It may have been deleted in this session, or the link is out of date.
        </EmptyState>
      </div>
    );
  }

  const active: TabKey = (TABS.some((t) => t.key === tab) ? tab : 'overview') as TabKey;
  const versions = versionsForIdea(data, idea.id);
  const tasks = tasksForIdea(data, idea.id);
  const assets = assetsForIdea(data, idea.id);
  const campaign = data.campaigns.find((c) => c.id === idea.campaignId);
  const people = idea.peopleIds.map((id) => personOf(data, id)!).filter(Boolean);
  const counts: Record<TabKey, number | undefined> = {
    overview: undefined,
    assets: assets.length,
    versions: versions.length,
    tasks: tasks.filter((t) => !t.done).length,
  };

  return (
    <div className="page idea-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/ideas">Ideas</Link>
        <Icon name="chevronRight" size={14} />
        <span aria-current="page">{idea.title}</span>
      </nav>

      <header className="idea-head">
        <Cover art={idea.art} ratio="1 / 1" className="idea-head__cover" />
        <div className="idea-head__text">
          <p className="eyebrow">
            {campaign ? (
              <Link to={`/campaigns#${campaign.id}`}>{campaign.name}</Link>
            ) : (
              'No campaign'
            )}
            {idea.series && idea.series !== campaign?.name && <> · {idea.series}</>}
            {idea.archived && <span className="tag tag--muted">Archived</span>}
          </p>
          <h1 className="display">{idea.title}</h1>
          <div className="idea-head__meta">
            <label className="status-select">
              <span className="sr-only">Idea status</span>
              <select
                value={idea.status}
                onChange={(e) => dispatch({ type: 'idea/status', ideaId: idea.id, status: e.target.value as IdeaStatus })}
                aria-label="Idea status"
              >
                {IDEA_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <span className="meta-item">
              <Icon name="clock" size={14} /> <span className="sr-only">Due</span>
              {relativeDay(idea.due, data.today) === formatDay(idea.due) ? `Due ${formatDay(idea.due)}` : `${relativeDay(idea.due, data.today)} · ${formatDay(idea.due)}`}
            </span>
            <AvatarStack people={people} />
          </div>
        </div>
        <div className="idea-head__menu" ref={menuRef}>
          <button type="button" className="icon-btn" aria-label="Idea actions" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            <Icon name="more" />
          </button>
          {menu && (
            <div className="popover" role="menu">
              <button
                type="button"
                role="menuitem"
                className="popover__item"
                onClick={() => {
                  dispatch({ type: 'idea/archive', ideaId: idea.id, archived: !idea.archived });
                  toast(idea.archived ? 'Idea restored for this session.' : 'Idea archived for this session. Media and links are kept.', 'demo');
                  closeMenu();
                }}
              >
                <Icon name="archive" size={15} /> {idea.archived ? 'Restore from archive' : 'Archive idea'}
              </button>
              <button
                type="button"
                role="menuitem"
                className="popover__item popover__item--danger"
                onClick={() => {
                  closeMenu();
                  setConfirmDelete(true);
                }}
              >
                <Icon name="trash" size={15} /> Delete idea…
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="tabs tabs--underline" role="tablist" aria-label="Idea sections">
        {TABS.map((t) => (
          <NavLink key={t.key} to={t.key === 'overview' ? `/ideas/${idea.id}` : `/ideas/${idea.id}/${t.key}`} end role="tab" aria-selected={active === t.key} className={active === t.key ? 'is-active' : ''}>
            {t.label}
            {counts[t.key] !== undefined && <span className="count">{counts[t.key]}</span>}
          </NavLink>
        ))}
      </div>

      <section className="idea-body" role="tabpanel" aria-label={TABS.find((t) => t.key === active)!.label}>
        {!ready ? (
          <div className="card">
            <Skeleton lines={5} block />
          </div>
        ) : active === 'overview' ? (
          <IdeaOverview idea={idea} />
        ) : active === 'assets' ? (
          <IdeaAssets idea={idea} />
        ) : active === 'versions' ? (
          <IdeaVersions idea={idea} />
        ) : (
          <IdeaTasks idea={idea} />
        )}
      </section>

      {confirmDelete && (
        <DeleteIdeaModal
          ideaId={idea.id}
          onClose={() => setConfirmDelete(false)}
          onDeleted={() => {
            toast('Idea deleted for this session. Raw Library originals were kept.', 'demo');
            navigate('/ideas');
          }}
        />
      )}
    </div>
  );
}

function DeleteIdeaModal({ ideaId, onClose, onDeleted }: { ideaId: string; onClose: () => void; onDeleted: () => void }) {
  const { data, dispatch } = useStore();
  const idea = ideaOf(data, ideaId)!;
  const assets = assetsForIdea(data, ideaId);
  const kept = assets.filter((a) => a.inLibrary || a.ideaIds.length > 1);
  const removed = assets.filter((a) => !kept.includes(a));
  const versions = versionsForIdea(data, ideaId);
  return (
    <Modal
      title={`Delete “${idea.title}”?`}
      onClose={onClose}
      footer={
        <>
          <DemoTag>Session only</DemoTag>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => {
              dispatch({ type: 'idea/delete', ideaId });
              onDeleted();
            }}
          >
            Delete idea
          </button>
        </>
      }
    >
      <p>Archiving keeps everything for later reuse. Deleting removes this idea, its {versions.length} versions and its tasks.</p>
      <div className="delete-split">
        <div>
          <h3 className="h3">
            <Icon name="shield" size={15} /> Kept ({kept.length})
          </h3>
          <p className="muted">Raw Library originals and files used by other ideas are never removed with an idea.</p>
          <ul className="plain-list">
            {kept.map((a) => (
              <li key={a.id}>{a.name}</li>
            ))}
            {kept.length === 0 && <li className="muted">None</li>}
          </ul>
        </div>
        <div>
          <h3 className="h3">
            <Icon name="trash" size={15} /> Removed with the idea ({removed.length})
          </h3>
          <p className="muted">Promote any of these to the Raw Library first if you want to keep them.</p>
          <ul className="plain-list">
            {removed.map((a) => (
              <li key={a.id}>{a.name}</li>
            ))}
            {removed.length === 0 && <li className="muted">None</li>}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
