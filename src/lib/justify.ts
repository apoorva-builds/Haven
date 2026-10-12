/**
 * Justified rows for media of mixed proportions: every row spans the full
 * width, and each row's height is as close as possible to the target.
 * Widths come back in pixels; order is preserved.
 */
export interface JustifiedRow {
  start: number;
  end: number;
  height: number;
}

export function justify(ratios: number[], width: number, target: number, gap: number, maxHeight = target * 1.35): JustifiedRow[] {
  const rows: JustifiedRow[] = [];
  let start = 0;
  while (start < ratios.length) {
    let sum = 0;
    let best: JustifiedRow | null = null;
    for (let end = start; end < ratios.length; end++) {
      sum += ratios[end];
      const height = (width - gap * (end - start)) / sum;
      const row = { start, end: end + 1, height };
      if (!best || Math.abs(height - target) < Math.abs(best.height - target)) best = row;
      if (height < target) break;
    }
    const row = best!;
    // A short final row keeps the target height instead of stretching.
    if (row.end === ratios.length && row.height > maxHeight) row.height = target;
    rows.push(row);
    start = row.end;
  }
  return rows;
}
