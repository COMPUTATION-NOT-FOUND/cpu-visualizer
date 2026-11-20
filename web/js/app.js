// Page controller: CPU tabs, editor, assemble, clock / run / back, share links.
import { Editor } from './ui/editor.js';
import { sap1Machine } from './ui/sap1-view.js';
import { rvMachine } from './ui/rv-view.js';
import { EXAMPLES } from './examples.js';
import { createGuide } from './ui/guide.js';

const MACHINES = { sap1: sap1Machine, rv32i: rvMachine };
const SPEEDS = [1, 2, 5, 10, 30, 100, Infinity];
const HISTORY = 2000;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const editor = new Editor({ textarea: $('source'), gutter: $('gutter'), backdrop: $('backdrop'), scroller: $('editor') });
const ui = {
  examples: $('examples'), messages: $('messages'), reference: $('reference'), machine: $('machine'), status: $('status'),
  reset: $('btn-reset'), back: $('btn-back'), fwd: $('btn-fwd'), byClock: $('by-clock'), byInstr: $('by-instr'), run: $('btn-run'),
  speed: $('speed'), speedLabel: $('speed-label'),
};

const state = {
  cpu: 'sap1',
  machine: null, // adapter
  m: null,       // machine instance, null until a program assembles
  program: null,
  history: [],   // { s: snapshot, b: was an instruction boundary } before each clock, for Back
  atBound: true, // current state sits on an instruction boundary
  by: 'clock',   // what Back / Forward move by: 'clock' or 'instr'
  records: [],   // one per clock, for charts
  running: false,
  modified: false,
  sources: {},   // per-CPU editor text, so switching tabs keeps your work
  raf: 0,
  lastTick: 0,
};

// --- Messages ---------------------------------------------------------------

function showErrors(errors) {
  ui.messages.innerHTML = errors.slice(0, 12).map((e) => (e.line > 0
    ? `<div class="err"><button data-line="${e.line}">line ${e.line}</button>: ${esc(e.message)}</div>`
    : `<div class="err">${esc(e.message)}</div>`)).join('')
    + (errors.length > 12 ? `<div class="err">… and ${errors.length - 12} more</div>` : '');
  const hl = new Map(errors.filter((e) => e.line > 0).map((e) => [e.line, 'hl-err']));
  editor.setMarks(hl);
}
function showMessage(cls, html) { ui.messages.innerHTML = `<div class="${cls}">${html}</div>`; }

ui.messages.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-line]');
  if (b) editor.select(Number(b.dataset.line));
});

let toastTimer = 0;
function toast(text) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// --- Machine lifecycle ----------------------------------------------------------

function assembleAndLoad() {
  stop();
  const { errors, program } = state.machine.assemble(editor.value);
  state.modified = false;
  if (errors.length) {
    state.m = null;
    state.program = null;
    showErrors(errors);
    render();
    return false;
  }
  state.program = program;
  reset();
  const n = state.cpu === 'sap1' ? `${program.mem.length} bytes of RAM`
    : `${program.text.length} instruction${program.text.length === 1 ? '' : 's'}${program.data.length ? `, ${program.data.length} data bytes` : ''}`;
  showMessage('ok', `Assembled: ${n}.`);
  return true;
}

function reset() {
  stop();
  if (!state.program) return;
  state.m = state.machine.create(state.program);
  state.history = [];
  state.atBound = true;
  state.records = [state.machine.record(state.m)];
  render();
}

function push() {
  state.history.push({ s: state.machine.snapshot(state.m), b: state.atBound });
  if (state.history.length > HISTORY) state.history.shift();
}

function clock() {
  if (!state.m || state.machine.done(state.m)) return false;
  push();
  const M = state.machine, before = M.progress(state.m);
  M.step(state.m);
  // Same rule instrStep stops on, so instruction-sized Back lands where Forward started.
  state.atBound = M.done(state.m) || M.boundary(state.m, before);
  state.records.push(state.machine.record(state.m));
  if (state.records.length > HISTORY + 1) state.records.shift();
  return true;
}

function instruction() {
  if (!state.m || state.machine.done(state.m)) return false;
  // Step clock by clock so Back and the charts see every cycle.
  const M = state.machine, start = state.m;
  const probe = M.snapshot(start);
  M.instrStep(start);
  const target = M.clocks(start);
  M.restore(start, probe);
  while (M.clocks(start) < target && clock());
  return true;
}

// Undo one clock. History is capped, so past it replay from reset (the models are deterministic).
function unclock() {
  const M = state.machine;
  if (!state.history.length) {
    const target = M.clocks(state.m);
    if (target === 0) return false;
    state.m = M.create(state.program);
    state.history = [];
    state.atBound = true;
    state.records = [M.record(state.m)];
    while (M.clocks(state.m) < target && clock());
  }
  const h = state.history.pop();
  M.restore(state.m, h.s);
  state.atBound = h.b;
  if (state.records.length > 1) state.records.pop();
  return true;
}

function back() {
  stop();
  if (!state.m) return;
  if (state.by === 'instr') { while (unclock() && !state.atBound); } else unclock();
  render();
}

function forward() {
  stop();
  if (!state.m) { if (!assembleAndLoad()) return; }
  if (state.by === 'instr') instruction(); else clock();
  render();
}

function setBy(by) {
  state.by = by;
  try { localStorage.setItem('cpuviz.by', by); } catch {}
  renderControls();
}

// --- Run loop ------------------------------------------------------------------------

function speed() { return SPEEDS[Number(ui.speed.value)]; }

function run() {
  if (!state.m) { if (!assembleAndLoad()) return; }
  if (state.machine.done(state.m)) reset();
  state.running = true;
  state.lastTick = performance.now();
  state.acc = 0;
  state.raf = requestAnimationFrame(tick);
  renderControls();
}

function stop() {
  if (!state.running) return;
  state.running = false;
  cancelAnimationFrame(state.raf);
  renderControls();
}

function tick(now) {
  if (!state.running) return;
  const hz = speed();
  let stepped = false;
  if (hz === Infinity) {
    const end = now + 12;
    while (performance.now() < end && clock()) stepped = true;
  } else {
    state.acc += ((now - state.lastTick) / 1000) * hz;
    let n = Math.min(Math.floor(state.acc), 50);
    state.acc -= Math.floor(state.acc);
    while (n-- > 0 && clock()) stepped = true;
  }
  state.lastTick = now;
  const done = state.machine.done(state.m) || state.machine.clocks(state.m) >= state.machine.maxClocks;
  if (stepped || done) render();
  if (done) {
    stop();
    if (!state.machine.done(state.m)) showMessage('warn', `Paused after ${state.machine.maxClocks} clocks. The program may not halt. Press Run to keep going.`);
    return;
  }
  state.raf = requestAnimationFrame(tick);
}

// --- Rendering --------------------------------------------------------------------------

function renderControls() {
  const has = !!state.m, done = has && state.machine.done(state.m);
  ui.run.textContent = state.running ? 'Pause' : 'Run';
  ui.run.setAttribute('aria-pressed', String(state.running));
  ui.fwd.disabled = !has || done;
  ui.back.disabled = !has || state.machine.clocks(state.m) === 0;
  const unit = state.by === 'instr' ? 'instruction' : state.machine.clock;
  ui.back.title = `Back one ${unit} (Left arrow)`;
  ui.fwd.title = `Forward one ${unit} (Right arrow)`;
  ui.byClock.setAttribute('aria-checked', String(state.by === 'clock'));
  ui.byInstr.setAttribute('aria-checked', String(state.by === 'instr'));
  ui.reset.disabled = !has;
  const s = speed();
  ui.speedLabel.textContent = s === Infinity ? 'max' : `${s} Hz`;
}

function render() {
  renderControls();
  if (!state.m) {
    ui.status.innerHTML = state.program === null && ui.messages.querySelector('.err')
      ? '<b class="stop">fix the errors, then Assemble</b>' : '';
    ui.machine.innerHTML = '';
    return;
  }
  ui.status.innerHTML = state.machine.status(state.m) + (state.modified ? ' · <b class="stop">source modified</b>' : '');
  state.machine.render(ui.machine, state.m, state.records);
  if (!state.modified) {
    const { highlights, tags } = state.machine.marks(state.m);
    editor.setMarks(highlights, tags);
    const first = [...highlights.keys()][0];
    if (first && state.running === false) editor.reveal(first);
    else if (first && speed() <= 10) editor.reveal(first);
  }
}

// --- CPU / examples ------------------------------------------------------------------------

function fillExamples() {
  const list = EXAMPLES[state.cpu] || [];
  const groups = new Map();
  for (const ex of list) (groups.get(ex.group) || groups.set(ex.group, []).get(ex.group)).push(ex);
  ui.examples.innerHTML = '<option value="">Load an example…</option>' + [...groups].map(([g, xs]) =>
    `<optgroup label="${esc(g === 'bugs' ? 'Bug regressions' : g[0].toUpperCase() + g.slice(1))}">${
      xs.map((x) => `<option value="${esc(x.name)}" title="${esc(x.title)}">${esc(x.name)}</option>`).join('')}</optgroup>`).join('');
}

function loadExample(name) {
  const ex = (EXAMPLES[state.cpu] || []).find((x) => x.name === name);
  if (!ex) return;
  editor.value = ex.source;
  assembleAndLoad();
  ui.examples.value = '';
}

function selectCpu(cpu, source) {
  if (!MACHINES[cpu]) cpu = 'sap1';
  stop();
  if (state.machine) state.sources[state.cpu] = editor.value;
  state.cpu = cpu;
  state.machine = MACHINES[cpu];
  for (const b of document.querySelectorAll('.cpu-tabs [role=tab]')) {
    const on = b.dataset.cpu === cpu;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  }
  ui.reference.innerHTML = state.machine.reference;
  fillExamples();
  state.m = null;
  state.program = null;
  ui.messages.innerHTML = '';
  const text = source ?? state.sources[cpu];
  if (text != null) { editor.value = text; assembleAndLoad(); } else loadExample(state.machine.defaultExample);
}

// --- Share links: #cpu=sap1&src=<base64url utf-8> -------------------------------------------

function encode(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function share() {
  const at = state.m && !state.modified ? state.machine.clocks(state.m) : 0;
  const url = `${location.origin}${location.pathname}#cpu=${state.cpu}${at ? `&at=${at}` : ''}&src=${encode(editor.value)}`;
  history.replaceState(null, '', url);
  try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { toast('Link is in the address bar'); }
}

function fromHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  let src = null;
  try { if (h.get('src')) src = decode(h.get('src')); } catch { /* bad link: fall back to the example */ }
  return { cpu: h.get('cpu') || 'sap1', src, at: Math.max(0, Math.min(Number(h.get('at')) || 0, 100000)) };
}

// --- Events ----------------------------------------------------------------------------------

document.querySelector('.cpu-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cpu]');
  if (b && b.dataset.cpu !== state.cpu) selectCpu(b.dataset.cpu);
});
document.querySelector('.cpu-tabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const next = state.cpu === 'sap1' ? 'rv32i' : 'sap1';
  selectCpu(next);
  $(`tab-${next}`).focus();
});
ui.examples.addEventListener('change', () => loadExample(ui.examples.value));
$('btn-assemble').addEventListener('click', assembleAndLoad);
$('btn-share').addEventListener('click', share);
ui.reset.addEventListener('click', reset);
ui.back.addEventListener('click', back);
ui.fwd.addEventListener('click', forward);
ui.byClock.addEventListener('click', () => setBy('clock'));
ui.byInstr.addEventListener('click', () => setBy('instr'));
try { if (localStorage.getItem('cpuviz.by') === 'instr') state.by = 'instr'; } catch {}
ui.run.addEventListener('click', () => (state.running ? stop() : run()));
ui.speed.addEventListener('input', renderControls);

$('source').addEventListener('input', () => {
  if (state.modified) return;
  stop();
  state.modified = true;
  editor.setMarks();
  if (state.m) ui.status.innerHTML = state.machine.status(state.m) + ' · <b class="stop">source modified: Assemble to reload</b>';
});

const guide = createGuide({ getCpu: () => state.cpu, open: (cpu, source) => selectCpu(cpu, source) });
document.getElementById('guide-btn').addEventListener('click', () => guide.show());

document.addEventListener('keydown', (e) => {
  if (document.querySelector('dialog[open]')) return; // the guide handles its own keys (Esc closes it)
  const t = e.target instanceof Element ? e.target : document.body;
  if (e.key === '?' && !t.closest('textarea, input, select')) { e.preventDefault(); guide.show(); return; }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); assembleAndLoad(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey || t.closest('textarea, input, select, [role=tab]')) return;
  const k = e.key.toLowerCase();
  const once = (f) => () => { stop(); if (state.m) { f(); render(); } };
  const act = {
    arrowright: forward, arrowleft: back, b: back,
    s: once(clock), i: once(instruction), r: () => ui.run.click(), z: reset,
  }[k];
  if (act) { e.preventDefault(); act(); }
});

window.addEventListener('resize', () => editor.layout());

const start = fromHash();
selectCpu(start.cpu, start.src ?? undefined);
if (start.at && state.m) {
  while (state.machine.clocks(state.m) < start.at && clock());
  render();
}

// #guide or #guide=pseudo opens the guide (also combinable: #cpu=rv32i&guide=hazards)
const guideAt = new URLSearchParams(location.hash.slice(1)).get('guide');
if (guideAt != null) guide.show(guideAt || undefined);
