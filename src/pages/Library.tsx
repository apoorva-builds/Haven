import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ASSET_KIND_LABEL, type AssetKind } from '../data/types';
import { AssetCard } from '../components/AssetCard';
import { DemoUploader } from '../components/DemoUploader';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { DemoTag, EmptyState, LoadingGrid, PageHeader, Progress, SelectField, useSimulatedLoad } from '../components/ui';
import { addDays, formatSize } from '../lib/dates';
import { rawLibrary, storageUsedGB } from '../state/selectors';
import { useStore } from '../state/store';

export function LibraryPage() {
  const { data } = useStore();
  const ready = useSimulatedLoad();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<string[]>([]);
  const [packaging, setPackaging] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const q = params.get('q') ?? '';
  const kind = params.get('kind') ?? 'all';
  const campaign = params.get('campaign') ?? 'all';
  const platform = params.get('platform') ?? 'all';
  const person = params.get('person') ?? 'all';
  const when = params.get('when') ?? 'any';
  const set = (key: string, value: string, fallback = 'all') => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const library = rawLibrary(data);
  const assets = useMemo(() => {
    const term = q.trim().toLowerCase();
    return library.filter((a) => {
      if (term && !`${a.name} ${a.tags.join(' ')} ${a.musicRights?.source ?? ''}`.toLowerCase().includes(term)) return false;
      if (kind === 'brand') {
        if (!a.tags.includes('brand kit')) return false;
      } else if (kind !== 'all' && a.kind !== kind) return false;
      if (campaign !== 'all' && a.campaignId !== campaign) return false;
      if (platform !== 'all' && !a.platforms.includes(platform as never)) return false;
      if (person !== 'all' && a.uploadedById !== person) return false;
      if (when === '7' && a.uploadedAt < addDays(data.today, -7)) return false;
      if (when === '30' && a.uploadedAt < addDays(data.today, -30)) return false;
      if (when === 'older' && a.uploadedAt >= addDays(data.today, -30)) return false;
      return true;
    });
  }, [library, q, kind, campaign, platform, person, when, data.today]);

  const used = storageUsedGB(data);
  const limit = data.workspace.storageLimitGB;
  const pct = used / limit;
  const byKind = (['final', 'raw', 'cutaway', 'photo', 'audio', 'document'] as AssetKind[]).map((k) => ({
    kind: k,
    gb: data.assets.filter((a) => a.kind === k || (k === 'photo' && a.kind === 'cover')).reduce((s, a) => s + a.sizeMB, 0) / 1024,
  }));
  const dupes = data.assets.filter((a) => a.duplicateOfId);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const anyFilter = q || kind !== 'all' || campaign !== 'all' || platform !== 'all' || person !== 'all' || when !== 'any';

  return (
    <div className="page">
      <PageHeader
        eyebrow="Raw Library"
        info="library"
        title="Originals, kept safe"
        lede={
          <>
            Source files you reuse. Finished posts live in the{' '}
            <Link className="inline-link" to="/gallery">
              Creation Gallery
            </Link>
            .
          </>
        }
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setShowUpload((s) => !s)} aria-expanded={showUpload}>
            <Icon name="upload" size={16} /> Upload
          </button>
        }
      />

      <section className="storage card" aria-labelledby="storage-h">
        <div className="storage__top">
          <div>
            <h2 id="storage-h" className="h3">
              Workspace storage <DemoTag>Demo figures</DemoTag>
            </h2>
            <p className="storage__big">
              {Math.round(used)} GB <span className="muted">of {limit} GB</span>
            </p>
          </div>
          <div className="storage__actions">
            <button type="button" className="btn btn--ghost btn--sm" disabled title="Storage add-ons arrive with billing in Milestone 3">
              Add storage <span className="soon">Milestone 3</span>
            </button>
          </div>
        </div>
        <Progress value={pct} label="Storage used (demo figures)" tone={pct > 0.9 ? 'danger' : pct > 0.75 ? 'warn' : 'accent'} />
        <ul className="storage__legend">
          {byKind.map((k) => (
            <li key={k.kind}>
              {k.kind === 'final' ? 'Finished videos (Creation Gallery)' : ASSET_KIND_LABEL[k.kind]} <strong>{formatSize(k.gb * 1024)}</strong>
            </li>
          ))}
          <li>
            Other project media <strong>{data.workspace.otherStorageGB} GB</strong>
          </li>
        </ul>
        <p className="field-hint">
          <Icon name="shield" size={13} /> At the limit, new uploads pause and you choose what to archive or add. Haven never removes originals on its own.
        </p>
      </section>

      {dupes.length > 0 && (
        <div className="banner banner--warn" role="note">
          <Icon name="copy" size={16} />
          <span>
            {dupes.length} possible duplicate{dupes.length > 1 ? 's' : ''} found across the workspace ({formatSize(dupes.reduce((s, a) => s + a.sizeMB, 0))}). Review them in each idea’s Assets — Haven won’t remove either copy
            without you.
          </span>
        </div>
      )}

      {showUpload && <DemoUploader toLibrary />}

      <div className="filters" role="group" aria-label="Filter library">
        <label className="filter-search">
          <Icon name="search" size={16} />
          <input type="search" placeholder="Search names, tags, music sources" value={q} onChange={(e) => set('q', e.target.value, '')} aria-label="Search library" />
        </label>
        <SelectField label="Type" value={kind} onChange={(v) => set('kind', v)}>
          <option value="all">All types</option>
          <option value="brand">Brand kit</option>
          {(Object.keys(ASSET_KIND_LABEL) as AssetKind[]).filter((k) => k !== 'final').map((k) => (
            <option key={k} value={k}>
              {ASSET_KIND_LABEL[k]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Campaign" value={campaign} onChange={(v) => set('campaign', v)}>
          <option value="all">All campaigns</option>
          {data.campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Platform" value={platform} onChange={(v) => set('platform', v)}>
          <option value="all">Any platform</option>
          {data.platforms
            .filter((p) => data.accounts.some((a) => a.platform === p.id))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </SelectField>
        <SelectField label="Person" value={person} onChange={(v) => set('person', v)}>
          <option value="all">Anyone</option>
          {data.people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Date" value={when} onChange={(v) => set('when', v, 'any')}>
          <option value="any">Any time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="older">Older</option>
        </SelectField>
      </div>

      {selected.length > 0 && (
        <div className="selection-bar" role="region" aria-label="Selection">
          <span>
            {selected.length} selected · {formatSize(data.assets.filter((a) => selected.includes(a.id)).reduce((s, a) => s + a.sizeMB, 0))}
          </span>
          <span className="spacer" />
          <button type="button" className="link-btn" onClick={() => setSelected([])}>
            Clear
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setPackaging(true)}>
            <Icon name="download" size={14} /> Download package
          </button>
        </div>
      )}

      {!ready ? (
        <LoadingGrid count={6} label="Loading library" />
      ) : assets.length === 0 ? (
        <EmptyState
          icon="library"
          title={anyFilter ? 'No assets match' : 'Your Raw Library is empty'}
          action={
            anyFilter ? (
              <button type="button" className="btn btn--ghost" onClick={() => setParams({}, { replace: true })}>
                Clear filters
              </button>
            ) : undefined
          }
        >
          {anyFilter ? 'Try a broader search or a different filter.' : 'Promote selects from any idea, or upload brand assets and music.'}
        </EmptyState>
      ) : (
        <div className="asset-grid">
          {assets.map((a) => (
            <AssetCard key={a.id} asset={a} selectable selected={selected.includes(a.id)} onSelect={() => toggle(a.id)} />
          ))}
        </div>
      )}

      {packaging && <PackageModal ids={selected} onClose={() => setPackaging(false)} />}
    </div>
  );
}

function PackageModal({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const { data } = useStore();
  const toast = useToast();
  const [structure, setStructure] = useState<'kind' | 'campaign'>('kind');
  const [proxies, setProxies] = useState(false);
  const assets = data.assets.filter((a) => ids.includes(a.id));
  const groups = new Map<string, string[]>();
  assets.forEach((a) => {
    const key = structure === 'kind' ? ASSET_KIND_LABEL[a.kind] : data.campaigns.find((c) => c.id === a.campaignId)?.name ?? 'No campaign';
    groups.set(key, [...(groups.get(key) ?? []), a.name]);
  });
  return (
    <Modal
      title="Download package for editing"
      onClose={onClose}
      footer={
        <>
          <DemoTag>No files produced</DemoTag>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              toast('Demo: nothing was downloaded. Organised packages arrive with secure storage in Milestone 2.', 'demo');
              onClose();
            }}
          >
            Prepare package
          </button>
        </>
      }
    >
      <div className="form">
        <SelectField label="Folders by" value={structure} onChange={(v) => setStructure(v as 'kind' | 'campaign')} compact={false}>
          <option value="kind">Asset type</option>
          <option value="campaign">Campaign</option>
        </SelectField>
        <label className="check-row">
          <input type="checkbox" checked={proxies} onChange={(e) => setProxies(e.target.checked)} /> Include lightweight proxies for offline editing
        </label>
        <div className="package-tree" aria-label="Package preview">
          <p className="mono">Lane-Studio-package/</p>
          {[...groups.entries()].map(([folder, files]) => (
            <div key={folder}>
              <p className="mono">&nbsp;&nbsp;{folder}/</p>
              {files.map((f) => (
                <p key={f} className="mono muted">
                  &nbsp;&nbsp;&nbsp;&nbsp;{f}
                </p>
              ))}
            </div>
          ))}
          <p className="mono muted">&nbsp;&nbsp;music-rights.txt</p>
        </div>
      </div>
    </Modal>
  );
}
