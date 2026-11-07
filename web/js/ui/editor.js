// Plain textarea with a line-number gutter and a backdrop for line highlights.
// Highlights: Map(line -> class), tags: Map(line -> [{ text, color }]).

export class Editor {
  constructor({ textarea, gutter, backdrop, scroller }) {
    Object.assign(this, { ta: textarea, gutter, backdrop, scroller });
    this.highlights = new Map();
    this.tags = new Map();
    this.ta.addEventListener('input', () => this.layout());
    this.ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        // Tab inserts spaces; Esc then Tab still leaves the editor (keyboard escape hatch).
        if (this.escaped) { this.escaped = false; return; }
        e.preventDefault();
        const { selectionStart: s, selectionEnd: t, value } = this.ta;
        const ins = '        '.slice(0, 8 - ((s - value.lastIndexOf('\n', s - 1) - 1) % 8));
        this.ta.setRangeText(ins, s, t, 'end');
        this.ta.dispatchEvent(new Event('input'));
      } else this.escaped = e.key === 'Escape';
    });
    this.layout();
  }

  get value() { return this.ta.value; }
  set value(v) { this.ta.value = v; this.layout(); }

  setMarks(highlights = new Map(), tags = new Map()) {
    this.highlights = highlights;
    this.tags = tags;
    this.layout();
  }

  layout() {
    const n = this.ta.value.split('\n').length;
    const g = [], b = [];
    for (let i = 1; i <= n; i++) {
      const tags = (this.tags.get(i) || [])
        .map((t) => `<span class="tag" style="background:${t.color}">${t.text}</span>`).join('');
      g.push(`<div>${tags}${i}</div>`);
      const cls = this.highlights.get(i);
      b.push(cls ? `<div class="${cls}"></div>` : '<div></div>');
    }
    this.gutter.innerHTML = g.join('');
    this.backdrop.innerHTML = b.join('');
    // Grow the textarea to fit its text so the outer box scrolls both columns together.
    this.ta.style.height = '0';
    this.ta.style.height = `${Math.max(this.ta.scrollHeight, this.scroller.clientHeight)}px`;
    const longest = Math.max(...this.ta.value.split('\n').map((l) => l.replace(/\t/g, '        ').length));
    this.ta.style.width = `calc(${longest + 2}ch + 20px)`;
    this.ta.style.minWidth = '100%';
  }

  // Scroll so that `line` is visible, without stealing focus.
  reveal(line) {
    const top = (line - 1) * 20 + 8, h = this.scroller.clientHeight;
    if (top < this.scroller.scrollTop || top + 20 > this.scroller.scrollTop + h) {
      this.scroller.scrollTop = Math.max(0, top - h / 3);
    }
  }

  select(line) {
    const lines = this.ta.value.split('\n');
    let start = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) start += lines[i].length + 1;
    this.ta.focus();
    this.ta.setSelectionRange(start, start + (lines[line - 1] || '').length);
    this.reveal(line);
  }
}
