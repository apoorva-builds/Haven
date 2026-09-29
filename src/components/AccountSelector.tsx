import { useCallback, useState } from 'react';
import { accountOf, platformOf } from '../state/selectors';
import { useStore } from '../state/store';
import { Icon } from './Icon';
import { PlatformGlyph, useDismiss } from './ui';

/** Label used wherever an account is named. Illustrative accounts carry "(demo)" in their handle. */
export function useAccountName() {
  const { data } = useStore();
  return (id: string) => accountOf(data, id)?.handle ?? '';
}

/** One compact control for choosing All accounts or a single account, grouped by brand. */
export function AccountSelector({ value, onChange }: { value: string; onChange: (accountId: string) => void }) {
  const { data } = useStore();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);
  const name = useAccountName();
  const current = accountOf(data, value);
  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="acct-select" ref={ref}>
      <button type="button" className="acct-select__btn" aria-haspopup="menu" aria-expanded={open} aria-label={`Account: ${current ? name(current.id) : 'All accounts'}`} onClick={() => setOpen((o) => !o)}>
        {current ? <PlatformGlyph platform={platformOf(data, current.platform)} size="md" /> : <span className="acct-select__all" aria-hidden="true"><Icon name="grid" size={16} /></span>}
        <span className="acct-select__text">
          <span className="acct-select__name">{current ? name(current.id) : 'All accounts'}</span>
          <span className="acct-select__sub">
            {current ? `${data.brands.find((b) => b.id === current.brandId)?.name} · ${platformOf(data, current.platform).name}` : `${data.accounts.length} accounts · ${data.brands.length} brands`}
          </span>
        </span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <div className="popover acct-select__menu" role="menu" aria-label="Choose account">
          <button type="button" role="menuitemradio" aria-checked={!current} className="popover__item" onClick={() => pick('all')}>
            <span className="acct-select__all" aria-hidden="true">
              <Icon name="grid" size={14} />
            </span>
            All accounts
            {!current && <Icon name="check" size={14} className="acct-select__tick" />}
          </button>
          {data.brands.map((brand) => (
            <div key={brand.id} role="group" aria-label={brand.name}>
              <p className="popover__label">{brand.name}</p>
              {data.accounts
                .filter((a) => a.brandId === brand.id)
                .map((a) => (
                  <button key={a.id} type="button" role="menuitemradio" aria-checked={value === a.id} className="popover__item" onClick={() => pick(a.id)}>
                    <PlatformGlyph platform={platformOf(data, a.platform)} size="sm" />
                    <span className="acct-select__opt">{name(a.id)}</span>
                    {a.identity === 'illustrative' && <span className="soon">Illustrative</span>}
                    {value === a.id && <Icon name="check" size={14} className="acct-select__tick" />}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
