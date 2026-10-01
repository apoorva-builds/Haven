import { useCallback, useEffect, useRef, useState } from 'react';
import type { Person } from '../data/types';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { useDismiss } from './ui';

/*
 * An optional personal photo for Today. Preview: it's kept in this browser
 * only (localStorage), per person, and never sent anywhere. Real accounts
 * will store it with the person's profile.
 */
const key = (personId: string) => `haven.photo.${personId}`;

function readPhoto(personId: string): string | null {
  try {
    return localStorage.getItem(key(personId));
  } catch {
    return null;
  }
}

/** Shrinks a chosen image to a small square JPEG so it fits in browser storage. */
async function toSmallSquare(file: File, size = 360): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    canvas.getContext('2d')!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PersonalPhoto({ person }: { person: Person }) {
  const toast = useToast();
  const [photo, setPhoto] = useState<string | null>(() => readPhoto(person.id));
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);

  // Another person (e.g. "Preview as") has their own photo, or none.
  useEffect(() => setPhoto(readPhoto(person.id)), [person.id]);

  const save = (value: string | null) => {
    try {
      if (value) localStorage.setItem(key(person.id), value);
      else localStorage.removeItem(key(person.id));
      setPhoto(value);
      toast(value ? 'Photo saved in this browser only (preview). It isn’t uploaded.' : 'Photo removed.', 'demo');
    } catch {
      toast('This browser couldn’t keep the photo. Try a smaller image.', 'info');
    }
  };

  const initials = person.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2);

  return (
    <div className={`pphoto ${photo ? 'has-photo' : ''}`} ref={ref}>
      <button type="button" className="pphoto__btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} aria-label={photo ? 'Change your photo' : 'Add a photo of you'}>
        {photo ? <img src={photo} alt="" /> : <span className="pphoto__initials">{initials}</span>}
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
              onClick={() => {
                close();
                save(null);
              }}
            >
              <Icon name="trash" size={15} /> Remove photo
            </button>
          )}
          <p className="pphoto__note">Preview: kept in this browser only, never uploaded.</p>
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
          try {
            save(await toSmallSquare(file));
          } catch {
            toast('That image couldn’t be read. Try a JPEG or PNG.', 'info');
          }
        }}
      />
    </div>
  );
}
