import { useCallback, useRef, useState } from 'react';
import type { Person } from '../data/types';
import { MAX_PHOTO_MB, saveProfile, toSquarePhoto, useProfile } from '../state/profile';
import { useTheme } from '../state/theme';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { initialsOf, useDismiss } from './ui';

/**
 * The profile photo on Today. It is the same photo as the avatar menu and
 * every avatar of this person. Preview: kept in this browser only.
 */
export function PersonalPhoto({ person }: { person: Person }) {
  const toast = useToast();
  const { photo } = useProfile(person.id);
  const { canEdit } = useTheme();
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);

  const save = (value: string | null) => {
    const r = saveProfile(person.id, { photo: value ?? undefined });
    if (r.ok) toast(value ? 'Photo saved in this browser only (preview). It isn’t uploaded.' : 'Photo removed.', 'demo');
    else toast(r.reason, 'info');
  };

  return (
    <div className={`pphoto ${photo ? 'has-photo' : ''}`} ref={ref}>
      <button type="button" className="pphoto__btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} aria-label={photo ? 'Change your photo' : 'Add a photo of you'}>
        {photo ? <img src={photo} alt="" /> : <span className="pphoto__initials">{initialsOf(person.name)}</span>}
        <span className="pphoto__edit" aria-hidden="true">
          <Icon name={photo ? 'image' : 'plus'} size={13} />
        </span>
      </button>
      {open && (
        <div className="popover pphoto__menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="popover__item"
            disabled={!canEdit}
            onClick={() => {
              close();
              input.current?.click();
            }}
          >
            <Icon name="upload" size={15} /> {photo ? 'Choose another photo' : 'Choose a photo'}
          </button>
          {photo && (
            <button
              type="button"
              role="menuitem"
              className="popover__item"
              disabled={!canEdit}
              onClick={() => {
                close();
                save(null);
              }}
            >
              <Icon name="trash" size={15} /> Remove photo
            </button>
          )}
          <p className="pphoto__note">{canEdit ? 'Preview: kept in this browser only, never uploaded.' : `Only ${person.name} can change their photo.`}</p>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        data-testid="personal-photo-input"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (!file.type.startsWith('image/')) return toast('Choose an image file for your photo.', 'info');
          if (file.size > MAX_PHOTO_MB * 1024 * 1024) return toast(`That image is over ${MAX_PHOTO_MB} MB. Choose a smaller one.`, 'info');
          try {
            save(await toSquarePhoto(file));
          } catch {
            toast('That image couldn’t be read. Try a JPEG or PNG.', 'info');
          }
        }}
      />
    </div>
  );
}
