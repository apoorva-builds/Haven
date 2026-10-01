import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Cut, VideoProject } from '../../data/types';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { AddStorageModal, StorageMeter } from '../../components/Storage';
import { useToast } from '../../components/Toast';
import { DemoTag, PlatformGlyph } from '../../components/ui';
import { formatSize } from '../../lib/dates';
import { zonedDay } from '../../lib/time';
import { cutDeletion, cutsOf, lengthLabel, notesOf, projectStorageMB } from '../../lib/videoStudio';
import { useStore } from '../../state/store';

const KIND: Record<Cut['kind'], string> = { footage: 'Footage', draft: 'Draft', final: 'Final cut' };

/**
 * Every cut of one video, oldest first, then where it was posted. Sizes are
 * per file; the total counts each file once.
 */
export function CutHistory({ project, onOpen, onCompare, onUpload }: { project: VideoProject; onOpen: (cutId: string) => void; onCompare: (a: string, b: string) => void; onUpload: () => void }) {
  const { data, dispatch, allowed } = useStore();
  const toast = useToast();
  const cuts = cutsOf(data, project.id);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<Cut | null>(null);
  const [addStorage, setAddStorage] = useState(false);
  const probe = cuts[0]?.id ?? '';
  const mayEdit = allowed({ type: 'studio/cut-update', cutId: probe, label: 'x' });
  const mayDelete = allowed({ type: 'studio/cut-delete', cutId: probe });
  const versions = data.versions.filter((v) => project.versionIds.includes(v.id));
  const posted = versions.filter((v) => v.status === 'Posted' && v.postedAt);
  const current = cuts.find((c) => c.id === project.currentCutId);

  return (
    <div className="history">
      <ol className="history__list" aria-label="Cuts, oldest first" data-testid="cut-history">
        {cuts.map((c, i) => {
          const asset = data.assets.find((a) => a.id === c.assetId);
          const notes = notesOf(data, c.id);
          const by = data.people.find((p) => p.id === c.addedById);
          const isCurrent = c.id === project.currentCutId;
          const isApproved = c.id === project.approvedCutId;
          return (
            <li key={c.id} className={`hrow ${isCurrent ? 'is-current' : ''} ${c.archived ? 'is-archived' : ''}`} data-cut={c.id}>
              <span className="hrow__index" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="hrow__main">
                {renaming === c.id ? (
                  <form
                    className="hrow__rename"
                    onSubmit={(e) => {
                      e.preventDefault();
                      dispatch({ type: 'studio/cut-update', cutId: c.id, label: name });
                      setRenaming(null);
                    }}
                  >
                    <input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Cut name" />
                    <button type="submit" className="btn btn--primary btn--xs">
                      Save
                    </button>
                    <button type="button" className="btn btn--ghost btn--xs" onClick={() => setRenaming(null)}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <h3 className="hrow__label">
                    <button type="button" className="hrow__open" onClick={() => onOpen(c.id)}>
                      {c.label}
                    </button>
                    {isCurrent && <span className="hbadge hbadge--current">Current</span>}
                    {isApproved && <span className="hbadge hbadge--approved">Approved</span>}
                    {c.archived && <span className="hbadge">Archived</span>}
                  </h3>
                )}
                <p className="hrow__meta">
                  {KIND[c.kind]} · {asset?.durationSec !== undefined ? lengthLabel(asset.durationSec) : 'length unknown'} · <span data-testid="cut-size">{asset ? formatSize(asset.sizeMB) : '—'}</span> · {by?.name ?? 'Someone'},{' '}
                  {new Date(c.addedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: data.workspace.timeZone })}
                  {asset?.mediaSource === 'device-session' && ' · this device only'}
                  {asset && !asset.videoUrl && ' · placeholder, no playable file'}
                </p>
                <p className="hrow__notes">
                  {notes.length ? `${notes.filter((n) => !n.resolved).length} open of ${notes.length} notes` : 'No notes'}
                </p>
              </div>
              <div className="hrow__actions">
                {!isCurrent && mayEdit && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--xs"
                    onClick={() => {
                      dispatch({ type: 'studio/cut-current', cutId: c.id });
                      toast(`${c.label} is the current version again. ${current ? `${current.label} is kept.` : ''}`, 'ok');
                    }}
                  >
                    Make current
                  </button>
                )}
                {current && !isCurrent && asset?.videoUrl && (
                  <button type="button" className="btn btn--ghost btn--xs" onClick={() => onCompare(c.id, current.id)}>
                    Compare with {current.label}
                  </button>
                )}
                {mayEdit && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--xs"
                    onClick={() => {
                      setRenaming(c.id);
                      setName(c.label);
                    }}
                  >
                    Rename
                  </button>
                )}
                {mayEdit && !isCurrent && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--xs"
                    onClick={() => {
                      dispatch({ type: 'studio/cut-archive', cutId: c.id, archived: !c.archived });
                      if (!c.archived) toast(`${c.label} archived. It stays in the history and still uses storage.`, 'demo');
                    }}
                  >
                    {c.archived ? 'Unarchive' : 'Archive'}
                  </button>
                )}
                {mayDelete && (
                  <button type="button" className="btn btn--ghost btn--xs btn--danger-text" onClick={() => setDeleting(c)}>
                    Delete…
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {mayEdit && (
          <li className="hrow hrow--add">
            <span className="hrow__index" aria-hidden="true">
              +
            </span>
            <button type="button" className="btn btn--primary btn--sm" onClick={onUpload}>
              <Icon name="upload" size={14} /> Add a draft
            </button>
            <span className="muted small">A new upload never replaces an earlier cut.</span>
          </li>
        )}
        {posted.map((v) => {
          const account = data.accounts.find((a) => a.id === v.accountId);
          const platform = account && data.platforms.find((p) => p.id === account.platform);
          const day = zonedDay(v.postedAt!, data.workspace.timeZone);
          return (
            <li key={v.id} className="hrow hrow--posted">
              <span className="hrow__index" aria-hidden="true">
                <Icon name="check" size={14} />
              </span>
              <div className="hrow__main">
                <h3 className="hrow__label">
                  {platform && <PlatformGlyph platform={platform} size="sm" />} Posted on {platform?.name} {account?.handle}
                </h3>
                <p className="hrow__meta">
                  Recorded in Haven ({v.postSource === 'connected' ? 'from the connected account' : 'marked as posted by hand'}) ·{' '}
                  <Link className="inline-link" to={`/calendar?day=${day}`}>
                    See it in the calendar
                  </Link>
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <aside className="history__storage" aria-labelledby="hs-h">
        <h3 id="hs-h" className="h3">
          Storage <DemoTag title="Bundled samples use sample sizes; files you add use their real size.">Sample sizes</DemoTag>
        </h3>
        <p className="history__total">
          This video’s cuts: <strong data-testid="project-storage">{formatSize(projectStorageMB(data, project.id))}</strong>
        </p>
        <StorageMeter compact onAdd={allowed({ type: 'workspace/storage-add', gb: 1 }) ? () => setAddStorage(true) : undefined} />
        <ul className="history__rules">
          <li>A file linked in several places counts once.</li>
          <li>Archived cuts stay in history and still use storage.</li>
          <li>Deleting a cut frees its space, after you confirm, unless something else uses the file.</li>
          <li>Deleting a note or a link never touches the video file.</li>
        </ul>
      </aside>

      {deleting && <DeleteCutModal cut={deleting} onClose={() => setDeleting(null)} />}
      {addStorage && <AddStorageModal onClose={() => setAddStorage(false)} />}
    </div>
  );
}

function DeleteCutModal({ cut, onClose }: { cut: Cut; onClose: () => void }) {
  const { data, dispatch } = useStore();
  const toast = useToast();
  const effect = cutDeletion(data, cut.id);
  return (
    <Modal
      title={`Delete ${cut.label}?`}
      onClose={onClose}
      footer={
        <>
          <DemoTag>Session only</DemoTag>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Keep it
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => {
              dispatch({ type: 'studio/cut-delete', cutId: cut.id });
              toast(effect.freesMB ? `${cut.label} deleted. ${formatSize(effect.freesMB)} freed.` : `${cut.label} removed from this video. The file is kept.`, 'demo');
              onClose();
            }}
            data-testid="confirm-delete-cut"
          >
            Delete {cut.label}
          </button>
        </>
      }
    >
      <p>
        This removes {cut.label} from the video’s history{effect.notes ? `, with its ${effect.notes} notes` : ''}. Archiving keeps it instead.
      </p>
      {effect.keptFor.length ? (
        <p className="access-note">
          <Icon name="shield" size={14} /> The file is kept because it’s also used by {effect.keptFor.join(', ')}. No space is freed.
        </p>
      ) : (
        <p className="access-note" data-testid="frees">
          <Icon name="trash" size={14} /> Frees {formatSize(effect.freesMB)} of storage.
        </p>
      )}
    </Modal>
  );
}
