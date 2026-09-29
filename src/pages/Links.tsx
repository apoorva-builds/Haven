import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LINK_CATEGORY_LABEL, type LinkCategory } from '../data/types';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { DemoTag, EmptyState, ExternalLink, PageHeader, PlatformGlyph, Segmented, useSimulatedLoad, LoadingGrid } from '../components/ui';
import { accountOf, ideaOf, platformOf } from '../state/selectors';
import { useStore } from '../state/store';

const CATEGORIES = Object.keys(LINK_CATEGORY_LABEL) as LinkCategory[];

export function LinksPage() {
  const { data, dispatch } = useStore();
  const toast = useToast();
  const ready = useSimulatedLoad();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const cat = (params.get('cat') ?? 'all') as LinkCategory | 'all';
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [newCat, setNewCat] = useState<LinkCategory>('brand');

  const set = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const term = q.trim().toLowerCase();
  const links = data.links.filter((l) => (cat === 'all' || l.category === cat) && (!term || `${l.label} ${l.url} ${l.note ?? ''}`.toLowerCase().includes(term)));

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Link copied.', 'ok');
    } catch {
      toast('Couldn’t reach the clipboard — select the link text to copy it.', 'info');
    }
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !/^https?:\/\//.test(url.trim())) return;
    dispatch({ type: 'link/add', link: { category: newCat, label: label.trim(), url: url.trim() } });
    setLabel('');
    setUrl('');
    toast('Link saved for this session.', 'demo');
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Links"
        info="links"
        title="Every link you reach for"
        lede="Account pages, native analytics, live posts, affiliate URLs and brand resources in one place. Analytics links open the platform — Haven doesn’t pull numbers in."
      />
      <div className="filters">
        <label className="filter-search">
          <Icon name="search" size={16} />
          <input type="search" placeholder="Search links" value={q} onChange={(e) => set('q', e.target.value, '')} aria-label="Search links" />
        </label>
        <Segmented<LinkCategory | 'all'>
          label="Link type"
          value={cat}
          onChange={(v) => set('cat', v, 'all')}
          options={[{ value: 'all', label: 'All' }, ...CATEGORIES.map((c) => ({ value: c, label: LINK_CATEGORY_LABEL[c] }))]}
        />
      </div>

      {!ready ? (
        <LoadingGrid count={3} label="Loading links" />
      ) : links.length === 0 ? (
        <EmptyState icon="links" title="No links match">
          Try another type or search term.
        </EmptyState>
      ) : (
        <div className="link-groups">
          {CATEGORIES.filter((c) => cat === 'all' || c === cat).map((c) => {
            const group = links.filter((l) => l.category === c);
            if (!group.length) return null;
            return (
              <section key={c} className="panel" aria-labelledby={`lg-${c}`}>
                <h2 id={`lg-${c}`} className="h2">
                  {LINK_CATEGORY_LABEL[c]} <span className="count">{group.length}</span>
                </h2>
                <ul className="link-list">
                  {group.map((l) => {
                    const account = accountOf(data, l.accountId);
                    const idea = ideaOf(data, l.ideaId);
                    const campaign = data.campaigns.find((x) => x.id === l.campaignId);
                    return (
                      <li key={l.id} className="link-row">
                        {account ? <PlatformGlyph platform={platformOf(data, account.platform)} size="sm" /> : <span className="link-row__icon"><Icon name="links" size={14} /></span>}
                        <div className="link-row__text">
                          <ExternalLink href={l.url}>{l.label}</ExternalLink>
                          <p className="muted small">
                            {l.url.replace(/^https?:\/\//, '')}
                            {idea && (
                              <>
                                {' · '}
                                <Link to={`/ideas/${idea.id}`}>{idea.title}</Link>
                              </>
                            )}
                            {campaign && <> · {campaign.name}</>}
                          </p>
                          {l.note && <p className="small note-inline">{l.note}</p>}
                        </div>
                        <button type="button" className="icon-btn" onClick={() => copy(l.url)} aria-label={`Copy ${l.label}`}>
                          <Icon name="copy" size={16} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <form className="card link-form" onSubmit={add} aria-label="Save a link">
        <h2 className="h3">
          Save a link <DemoTag>Session only</DemoTag>
        </h2>
        <div className="link-form__row">
          <input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Link label" />
          <input type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="URL" />
          <select value={newCat} onChange={(e) => setNewCat(e.target.value as LinkCategory)} aria-label="Link type">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {LINK_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn--primary" disabled={!label.trim() || !/^https?:\/\//.test(url.trim())}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
