import { useState } from 'react';
import { Modal } from './Modal';
import { BrandLogo } from './Brand';

/** The single place that explains what this preview is and isn't. */
export function AboutPreviewButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="preview-chip" aria-haspopup="dialog" onClick={() => setOpen(true)} aria-label="Preview · sample data. About this preview">
        <span className="preview-chip__dot" aria-hidden="true" />
        <span className="preview-chip__long">Preview · sample data</span>
        <span className="preview-chip__short">Preview</span>
      </button>
      {open && (
        <Modal
          title="About this preview"
          onClose={() => setOpen(false)}
          footer={
            <button type="button" className="btn btn--primary" onClick={() => setOpen(false)}>
              Got it
            </button>
          }
        >
          <div className="about-brand">
            <BrandLogo variant="founder" height={120} />
          </div>
          <ul className="about-list">
            <li>
              <strong>Sample content.</strong> The brands, accounts, people, posts and files are fictional.
            </li>
            <li>
              <strong>Uploads are session-only.</strong> Files you choose stay in this browser tab and disappear when you reload. Nothing is uploaded or stored online.
            </li>
            <li>
              <strong>Follower counts are sample figures.</strong> They aren’t real and don’t update.
            </li>
            <li>
              <strong>Nothing is published or connected.</strong> Haven doesn’t post anything, and no social accounts are connected. A post shows as Posted only when you mark it and add its link.
            </li>
            <li>
              <strong>Changes reset on reload.</strong> Only your own profile photo and look are remembered, in this browser.
            </li>
          </ul>
        </Modal>
      )}
    </>
  );
}
