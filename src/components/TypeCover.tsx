/**
 * Quiet typographic cover for creations or ideas without playable media.
 * Replaces decorative artwork: the title set in type on a calm surface.
 */
export function TypeCover({ title, kicker, ratio = '4 / 5', className = '' }: { title: string; kicker?: string; ratio?: string; className?: string }) {
  return (
    <div className={`tcover ${className}`} style={{ aspectRatio: ratio }} role="img" aria-label={kicker ? `${title}, ${kicker}` : title}>
      {kicker && <span className="tcover__kicker">{kicker}</span>}
      <span className="tcover__title">{title}</span>
    </div>
  );
}
