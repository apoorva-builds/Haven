import { useState } from 'react';
import { ASSET_KIND_LABEL, type AssetKind, type Idea } from '../../data/types';
import { AssetCard } from '../../components/AssetCard';
import { DemoUploader } from '../../components/DemoUploader';
import { EmptyState, Segmented } from '../../components/ui';
import { formatSize } from '../../lib/dates';
import { assetsForIdea } from '../../state/selectors';
import { useStore } from '../../state/store';

type KindFilter = 'all' | 'selects' | AssetKind;

export function IdeaAssets({ idea }: { idea: Idea }) {
  const { data } = useStore();
  const [kind, setKind] = useState<KindFilter>('all');
  const all = assetsForIdea(data, idea.id);
  const shown = all.filter((a) => (kind === 'all' ? true : kind === 'selects' ? a.favorite : a.kind === kind));
  const total = all.reduce((s, a) => s + a.sizeMB, 0);
  const duplicates = all.filter((a) => a.duplicateOfId).length;

  const kinds = (Object.keys(ASSET_KIND_LABEL) as AssetKind[]).filter((k) => all.some((a) => a.kind === k));

  return (
    <div className="stack">
      <DemoUploader ideaId={idea.id} />
      <div className="filters">
        <Segmented<KindFilter>
          label="Asset type"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all', label: `All ${all.length}` },
            { value: 'selects', label: '★ Selects' },
            ...kinds.map((k) => ({ value: k, label: ASSET_KIND_LABEL[k] })),
          ]}
        />
        <span className="spacer" />
        <span className="muted">
          {formatSize(total)} for this idea{duplicates > 0 && ` · ${duplicates} possible duplicate${duplicates > 1 ? 's' : ''}`}
        </span>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon="film" title={all.length ? 'Nothing of this type' : 'No media gathered yet'}>
          {all.length ? 'Try another type, or star useful clips to build selects.' : 'Drop raw footage, cutaways, photos, and music here, or pull files from the Raw Library.'}
        </EmptyState>
      ) : (
        <div className="asset-grid">
          {shown.map((a) => (
            <AssetCard key={a.id} asset={a} />
          ))}
        </div>
      )}
    </div>
  );
}
