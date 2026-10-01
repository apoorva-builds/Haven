/**
 * Haven's wordmark. TEMPORARY placeholder, set in the display typeface.
 *
 * To use your own design: put your SVG files in public/brand/ and set the
 * paths below. A light and a dark version can differ; if you only have one,
 * set both to the same file.
 */
const WORDMARK_LIGHT: string | null = null; // e.g. '/brand/wordmark.svg'
const WORDMARK_DARK: string | null = null; // e.g. '/brand/wordmark-dark.svg'

export function Wordmark({ className = '' }: { className?: string }) {
  if (WORDMARK_LIGHT) {
    return (
      <span className={`wordmark wordmark--custom ${className}`}>
        <img className="wordmark__light" src={WORDMARK_LIGHT} alt="Haven" />
        <img className="wordmark__dark" src={WORDMARK_DARK ?? WORDMARK_LIGHT} alt="" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className={`wordmark ${className}`} role="img" aria-label="Haven">
      <span className="wordmark__type" aria-hidden="true">
        Haven
      </span>
      <span className="wordmark__dot" aria-hidden="true" />
    </span>
  );
}
