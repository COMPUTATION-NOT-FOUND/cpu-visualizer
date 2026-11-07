// Timing diagram: one column per clock, newest on the right.
// signals: [{ name, kind: 'bit' | 'bus', values: [...] }], `fmt` formats bus values.

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function waveform({ signals, labels, start = 0, fmt = (v) => v }) {
  const n = labels.length;
  const W = 26, H = 20, NAME = 64, top = 22;
  const width = NAME + Math.max(n, 1) * W + 8, height = top + (signals.length + 1) * H + 4;
  const o = [`<svg class="wave" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Timing diagram">`];
  const x = (i) => NAME + i * W;

  // Column headers and grid.
  for (let i = 0; i < n; i++) {
    if (i === n - 1) o.push(`<rect class="cur" x="${x(i)}" y="0" width="${W}" height="${height}"/>`);
    o.push(`<text class="name" x="${x(i) + W / 2}" y="12" text-anchor="middle">${esc(labels[i])}</text>`);
    o.push(`<line class="grid" x1="${x(i)}" y1="${top - 4}" x2="${x(i)}" y2="${height}"/>`);
  }

  // Clock.
  let y = top, d = '';
  o.push(`<text class="name" x="4" y="${y + 13}">clk</text>`);
  for (let i = 0; i < n; i++) {
    const a = x(i), m = a + W / 2, lo = y + H - 4, hi = y + 4;
    d += `${i ? 'L' : 'M'}${a},${lo} L${a},${hi} L${m},${hi} L${m},${lo} L${a + W},${lo} `;
  }
  if (d) o.push(`<path class="clk" d="${d}"/>`);

  for (const s of signals) {
    y += H;
    o.push(`<text class="name" x="4" y="${y + 13}">${esc(s.name)}</text>`);
    if (s.kind === 'bus') {
      let i = 0;
      while (i < n) {
        let j = i;
        while (j + 1 < n && s.values[j + 1] === s.values[i]) j++;
        const a = x(i) + 1, b = x(j + 1) - 1, t = y + 4, u = y + H - 4, mid = (t + u) / 2;
        if (s.values[i] == null) {
          o.push(`<line class="busz" x1="${a - 1}" y1="${mid}" x2="${b + 1}" y2="${mid}"/>`);
          i = j + 1;
          continue;
        }
        o.push(`<path class="busv" d="M${a},${mid} L${a + 3},${t} L${b - 3},${t} L${b},${mid} L${b - 3},${u} L${a + 3},${u} Z"/>`);
        const label = fmt(s.values[i]);
        if ((j - i + 1) * W >= String(label).length * 6.5 + 6) {
          o.push(`<text class="bust" x="${(a + b) / 2}" y="${mid + 3.5}" text-anchor="middle">${esc(label)}</text>`);
        }
        i = j + 1;
      }
    } else {
      let p = '';
      for (let i = 0; i < n; i++) {
        const v = s.values[i] ? y + 4 : y + H - 4;
        p += `${i ? 'L' : 'M'}${x(i)},${v} L${x(i + 1)},${v} `;
        if (s.values[i]) o.push(`<rect class="sig hi" x="${x(i)}" y="${y + 4}" width="${W}" height="${H - 8}"/>`);
      }
      if (p) o.push(`<path class="sig" d="${p}"/>`);
    }
  }
  o.push('</svg>');
  return o.join('');
}
