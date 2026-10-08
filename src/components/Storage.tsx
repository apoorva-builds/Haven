import { useState } from 'react';
import { formatSize } from '../lib/dates';
import { STORAGE_ADDONS, storageLimitGB, workspaceUsedGB } from '../lib/videoStudio';
import { useStore } from '../state/store';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { DemoTag, Progress } from './ui';

/** Workspace storage: used of allowance, each file counted once. */
export function StorageMeter({ compact = false, onAdd }: { compact?: boolean; onAdd?: () => void }) {
  const { data } = useStore();
  const used = workspaceUsedGB(data);
  const limit = storageLimitGB(data);
  const pct = used / limit;
  return (
    <div className={`smeter ${compact ? 'smeter--compact' : ''}`} data-testid="storage-meter">
      <p className="smeter__figure">
        <strong data-testid="storage-used">{formatSize(used * 1024)}</strong> <span className="muted">of {formatSize(limit * 1024)}</span>
        {data.workspace.addedStorageGB ? <span className="tag tag--muted">+{formatSize(data.workspace.addedStorageGB * 1024)} preview</span> : null}
      </p>
      <Progress value={pct} label="Workspace storage used (sample figures)" tone={pct > 0.9 ? 'danger' : pct > 0.75 ? 'warn' : 'accent'} />
      {onAdd && (
        <button type="button" className="btn btn--ghost btn--sm smeter__add" onClick={onAdd}>
          <Icon name="plus" size={14} /> Add storage
        </button>
      )}
    </div>
  );
}

/**
 * Add storage, previewed. Shows the cost and the resulting allowance before
 * anything changes. In the preview nothing is charged: the extra space lasts
 * for this session only.
 */
export function AddStorageModal({ onClose }: { onClose: () => void }) {
  const { data, dispatch, allowed } = useStore();
  const toast = useToast();
  const [choice, setChoice] = useState<number>(STORAGE_ADDONS[0].gb);
  const addon = STORAGE_ADDONS.find((a) => a.gb === choice)!;
  const limit = storageLimitGB(data);
  const used = workspaceUsedGB(data);
  const may = allowed({ type: 'workspace/storage-add', gb: choice });
  return (
    <Modal
      title="Add storage"
      onClose={onClose}
      footer={
        <>
          <DemoTag title="Preview: no payment is taken and nothing is billed.">No charge in the preview</DemoTag>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!may}
            onClick={() => {
              dispatch({ type: 'workspace/storage-add', gb: choice });
              toast(`Preview: allowance is now ${formatSize((limit + choice) * 1024)} for this session. Nothing was charged.`, 'demo');
              onClose();
            }}
          >
            Add {formatSize(choice * 1024)} in preview
          </button>
        </>
      }
    >
      <p className="muted">
        You’re using {formatSize(used * 1024)} of {formatSize(limit * 1024)}. Every draft you keep, including archived ones, counts. A file linked in several places counts once.
      </p>
      <fieldset className="addon-list">
        <legend className="sr-only">Storage add-on</legend>
        {STORAGE_ADDONS.map((a) => (
          <label key={a.gb} className={`addon ${choice === a.gb ? 'is-selected' : ''}`}>
            <input type="radio" name="addon" checked={choice === a.gb} onChange={() => setChoice(a.gb)} />
            <span className="addon__size">+{formatSize(a.gb * 1024)}</span>
            <span className="addon__price">${a.monthlyUSD}/month</span>
          </label>
        ))}
      </fieldset>
      <dl className="addon-summary" data-testid="addon-summary">
        <dt>New allowance</dt>
        <dd>{formatSize((limit + addon.gb) * 1024)}</dd>
        <dt>Would cost</dt>
        <dd>
          ${addon.monthlyUSD} a month, from the next billing date <span className="muted">(sample price)</span>
        </dd>
        <dt>Charged today</dt>
        <dd>$0 — preview only, no payment details are asked for</dd>
      </dl>
      {!may && (
        <p className="access-note">
          <Icon name="shield" size={14} /> Only the owner and admins change the plan.
        </p>
      )}
    </Modal>
  );
}
