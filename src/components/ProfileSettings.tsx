import { useEffect, useRef, useState } from 'react';
import { PALETTES, resolveAppearance, type Appearance, type PaletteId } from '../lib/palettes';
import { personOf } from '../state/selectors';
import { MAX_PHOTO_MB, saveProfile, toSquarePhoto, useProfile } from '../state/profile';
import { useStore } from '../state/store';
import { useTheme } from '../state/theme';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { initialsOf } from './ui';

const APPEARANCES: { id: Appearance; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'Match device' },
];

/**
 * One person's profile photo and look. Choices preview across the app while
 * the panel is open and are saved only with Save. They belong to this
 * person: other members keep their own look, and no work is changed.
 */
export function ProfileSettings({ onClose }: { onClose: () => void }) {
  const { data } = useStore();
  const toast = useToast();
  const me = personOf(data, data.currentUserId)!;
  const profile = useProfile(me.id);
  const theme = useTheme();
  const [appearance, setAppearance] = useState<Appearance>(profile.appearance);
  const [palette, setPalette] = useState<PaletteId>(profile.palette);
  /** undefined: unchanged; null: remove; string: new photo. */
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const shownPhoto = photo === undefined ? profile.photo : photo;
  const systemDark = !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const dirty = appearance !== profile.appearance || palette !== profile.palette || photo !== undefined;

  // Preview the look across the app while the panel is open.
  const { preview } = theme;
  useEffect(() => {
    preview(appearance === profile.appearance && palette === profile.palette ? null : { appearance, palette });
  }, [appearance, palette, profile.appearance, profile.palette, preview]);
  useEffect(() => () => preview(null), [preview]);

  const choose = async (file: File | undefined) => {
    setError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Choose an image file (JPEG, PNG, HEIC or WebP).');
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) return setError(`That image is over ${MAX_PHOTO_MB} MB. Choose a smaller one.`);
    setBusy(true);
    try {
      setPhoto(await toSquarePhoto(file));
    } catch {
      setError('That image couldn’t be read. Try a JPEG or PNG.');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const r = saveProfile(me.id, { appearance, palette, ...(photo !== undefined ? { photo: photo ?? undefined } : {}) });
    if (!r.ok) return setError(r.reason);
    preview(null);
    toast('Saved to your profile. Only your view changes.', 'ok');
    onClose();
  };

  return (
    <Modal
      title="Profile & appearance"
      onClose={onClose}
      wide
      footer={
        <>
          <p className="psettings__scope">Saved in this browser for the preview. With sign-in, it follows your account to every device.</p>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={!dirty || busy} data-testid="save-profile">
            Save
          </button>
        </>
      }
    >
      <div className="psettings" data-testid="profile-settings">
        <section className="psettings__photo" aria-labelledby="ps-photo">
          <h3 id="ps-photo" className="psettings__h">
            Photo
          </h3>
          <div className="psettings__me">
            <span className="psettings__avatar" style={{ ['--hue' as string]: me.hue }} data-testid="profile-avatar">
              {busy ? <span className="spinner spinner--ink" aria-label="Preparing photo" /> : shownPhoto ? <img src={shownPhoto} alt="Your profile photo" /> : <span aria-label={`Initials ${initialsOf(me.name)}`}>{initialsOf(me.name)}</span>}
            </span>
            <div>
              <p className="psettings__name">{me.name}</p>
              <p className="psettings__role">{me.role}</p>
              <div className="psettings__photo-actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => input.current?.click()} disabled={busy}>
                  <Icon name="upload" size={14} /> {shownPhoto ? 'Replace photo' : 'Upload photo'}
                </button>
                {shownPhoto && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPhoto(null)} disabled={busy}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
          {error && (
            <p className="psettings__error" role="alert">
              {error}
            </p>
          )}
          <p className="psettings__hint">Shown wherever you appear. Without one, your initials stand in.</p>
          <input ref={input} type="file" accept="image/*" hidden data-testid="profile-photo-input" onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            void choose(f);
          }} />
        </section>

        <section aria-labelledby="ps-look">
          <h3 id="ps-look" className="psettings__h">
            Appearance
          </h3>
          <div className="psettings__seg" role="radiogroup" aria-label="Appearance">
            {APPEARANCES.map((a) => (
              <button key={a.id} type="button" role="radio" aria-checked={appearance === a.id} className={appearance === a.id ? 'is-on' : ''} onClick={() => setAppearance(a.id)}>
                {a.label}
              </button>
            ))}
          </div>

          <h3 className="psettings__h psettings__h--gap">Palette</h3>
          <div className="psettings__palettes" role="radiogroup" aria-label="Palette">
            {PALETTES.map((p) => {
              const t = p[resolveAppearance(appearance, systemDark)];
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={palette === p.id}
                  className={`swatch ${palette === p.id ? 'is-on' : ''}`}
                  onClick={() => setPalette(p.id)}
                  data-palette-option={p.id}
                >
                  <span className="swatch__mini" style={{ background: t.canvas }} aria-hidden="true">
                    <span className="swatch__side" style={{ background: t['canvas-2'] }}>
                      <span style={{ background: t['cobalt-soft'] }} />
                      <span style={{ background: t.line }} />
                      <span style={{ background: t.line }} />
                    </span>
                    <span className="swatch__card" style={{ background: t.surface, boxShadow: `inset 0 0 0 1px ${t.line}` }}>
                      <span style={{ background: t.ink }} />
                      <span style={{ background: t['ink-3'] }} />
                      <span className="swatch__btn" style={{ background: t['cobalt-fill'] }} />
                    </span>
                  </span>
                  <span className="swatch__name">{p.name}</span>
                  <span className="swatch__mood">{p.mood}</span>
                  {palette === p.id && (
                    <span className="swatch__check" aria-hidden="true">
                      <Icon name="check" size={12} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="psettings__live" role="status">
            {appearance !== profile.appearance || palette !== profile.palette ? 'Previewing across Haven. Save to keep it, or Cancel to go back.' : 'This is your saved look.'}
          </p>
          <p className="psettings__hint">Only your view changes. Other members keep their own look, and your work, calendar and videos are unchanged.</p>
        </section>
      </div>
    </Modal>
  );
}
