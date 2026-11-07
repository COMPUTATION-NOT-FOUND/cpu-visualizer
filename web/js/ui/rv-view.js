// RISC-V 5-stage pipeline in the browser: the machine adapter used by app.js and its views.
import { assemble } from '../rv32i/asm.js';
import { disasm, REG_NAMES } from '../rv32i/isa.js';
import { fetchWord } from '../rv32i/iss.js';
import { Pipeline } from '../rv32i/pipeline.js';
import { waveform } from './wave.js';

const h8 = (v) => (v >>> 0).toString(16).padStart(8, '0');
const hx = (v) => '0x' + (v >>> 0).toString(16);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB'];
const COLOR = { IF: 'var(--st-if)', ID: 'var(--st-id)', EX: 'var(--st-ex)', MEM: 'var(--st-mem)', WB: 'var(--st-wb)' };
const CHART_COLS = 18;

// The current cycle's combinational signals (null once halted).
const sigOf = (p) => (p.halted ? null : p.sig || p.comb());
const dis = (x) => (x.valid ? disasm(x.word, x.pc) : null);

export const rvMachine = {
  id: 'rv32i',
  clock: 'cycle',
  defaultExample: 'fibonacci',
  maxClocks: 200000,

  assemble(source) {
    const r = assemble(source);
    return { errors: r.errors, program: r };
  },

  create(program) {
    const p = new Pipeline({ text: program.text, data: program.data });
    return { p, program, lastWrite: null, lastStore: null, seqInfo: new Map() };
  },

  step(m) {
    const p = m.p;
    if (p.halted) return false;
    const s = sigOf(p);
    m.lastWrite = s.regWriteW && s.rdW !== 0 ? s.rdW : null;
    m.lastStore = p.em.memWrite ? (s.exResultM & 0xffc) : null;
    p.step();
    return true;
  },

  instrStep(m) {
    if (m.p.halted) return false;
    const r = m.p.retired;
    for (let i = 0; i < 1000 && !m.p.halted && m.p.retired === r; i++) this.step(m);
    return true;
  },

  done: (m) => !!m.p.halted,
  clocks: (m) => m.p.cycle,

  snapshot(m) {
    const p = m.p;
    return {
      pcF: p.pcF, fd: p.fd, de: p.de, em: p.em, mw: p.mw, regs: p.regs.slice(), mem: p.mem.bytes.slice(),
      halting: p.halting, halted: p.halted, cycle: p.cycle, retired: p.retired, fetchSeq: p.fetchSeq, sig: p.sig,
      lastWrite: m.lastWrite, lastStore: m.lastStore,
    };
  },

  restore(m, snap) {
    const { regs, mem, lastWrite, lastStore, ...rest } = snap;
    Object.assign(m.p, rest);
    m.p.regs = regs.slice();
    m.p.mem.bytes = mem.slice();
    m.lastWrite = lastWrite;
    m.lastStore = lastStore;
  },

  // One column of the pipeline chart and waveform.
  record(m) {
    const p = m.p, s = sigOf(p);
    for (const x of [p.fd, p.de, p.em, p.mw]) {
      if (x.valid && x.seq && !m.seqInfo.has(x.seq)) m.seqInfo.set(x.seq, { pc: x.pc, word: x.word });
    }
    return {
      label: String(p.cycle), cycle: p.cycle, pcF: p.pcF,
      D: p.fd.valid ? p.fd.seq : 0, E: p.de.valid ? p.de.seq : 0, M: p.em.valid ? p.em.seq : 0, W: p.mw.valid ? p.mw.seq : 0,
      sig: s && {
        stallF: s.stallF, stallD: s.stallD, flushD: s.flushD, flushE: s.flushE, lwstall: s.lwstall,
        forwardA: s.forwardA, forwardB: s.forwardB, pcSrc: s.pcSrc, regWriteW: s.regWriteW && s.rdW !== 0,
      },
    };
  },

  status(m) {
    const p = m.p;
    const cpi = p.retired ? (p.cycle / p.retired).toFixed(2) : '—';
    const state = p.halted === 'illegal' ? '<b class="stop">illegal instruction</b>'
      : p.halted ? '<b class="halt">halted (ecall)</b>' : p.cycle ? '<b>running</b>' : '<b>ready</b>';
    return `${state} · cycle <b>${p.cycle}</b> · retired <b>${p.retired}</b> · CPI <b>${cpi}</b>`;
  },

  marks(m) {
    const p = m.p, lineOf = m.program.lineOf;
    const hl = new Map(), tags = new Map();
    const line = (pc) => {
      const i = (pc >>> 2);
      return (pc & 3) === 0 && i < lineOf.length ? lineOf[i] : -1;
    };
    const at = [['IF', p.halted || p.halting ? null : p.pcF], ['ID', p.fd.valid ? p.fd.pc : null],
      ['EX', p.de.valid ? p.de.pc : null], ['MEM', p.em.valid ? p.em.pc : null], ['WB', p.mw.valid ? p.mw.pc : null]];
    for (const [st, pc] of at) {
      if (pc == null) continue;
      const l = line(pc);
      if (l <= 0) continue;
      if (!hl.has(l)) hl.set(l, `hl-${st.toLowerCase()}`);
      if (!tags.has(l)) tags.set(l, []);
      tags.get(l).push({ text: st, color: COLOR[st] });
    }
    return { highlights: hl, tags };
  },

  render(root, m, records) {
    const p = m.p, s = sigOf(p);
    root.innerHTML = `
      <div class="card"><h2>Pipeline <span>${headline(p, s)}</span></h2>
        <div class="card-body">${datapath(m, s)}
          <div class="legend">
            <span><i style="background:var(--drive)"></i>forwarded value</span>
            <span><i style="background:var(--bad)"></i>flush / redirect</span>
            <span><i style="background:var(--muted)"></i>stall (register holds)</span>
          </div>
        </div>
        <p class="explain" style="margin:0 10px 10px">${explain(p, s)}</p>
      </div>
      <div class="card"><h2>Pipeline chart <span>one row per fetched instruction</span></h2>
        <div class="card-body scroll">${chart(m, records)}</div></div>
      <div class="row2">
        <div class="card"><h2>Registers <span>x0–x31</span></h2><div class="card-body">${regFile(m)}</div></div>
        <div class="card"><h2>Data memory <span>4 KiB, words</span></h2><div class="card-body scroll">${dataMem(m)}</div></div>
      </div>
      <div class="row2">
        <div class="card"><h2>Program <span>instruction memory</span></h2><div class="card-body scroll">${listing(m)}</div></div>
        <div class="card"><h2>Hazard signals <span>last ${Math.min(records.length, 30)} cycles</span></h2>
          <div class="card-body" style="overflow-x:auto">${wave(records.slice(-30))}</div></div>
      </div>`;
  },

  reference: `<summary>RV32I quick reference</summary>
    <table>
      <tr><th>Kind</th><th>Instructions</th></tr>
      <tr><td>ALU</td><td>add sub and or xor sll srl sra slt sltu</td></tr>
      <tr><td>ALU imm</td><td>addi andi ori xori slli srli srai slti sltiu</td></tr>
      <tr><td>Load / store</td><td>lb lh lw lbu lhu · sb sh sw — <code>lw rd, off(rs1)</code></td></tr>
      <tr><td>Branch</td><td>beq bne blt bge bltu bgeu — <code>beq rs1, rs2, label</code></td></tr>
      <tr><td>Jump</td><td>jal jalr · lui auipc</td></tr>
      <tr><td>Stop</td><td>ecall / ebreak</td></tr>
      <tr><td>Pseudo</td><td>li la mv nop j jr ret call not neg beqz bnez bgt ble …</td></tr>
      <tr><td>Data</td><td>.text .data .word .half .byte .space .align</td></tr>
    </table>
    <p>Code and data live in separate 4 KiB memories, both starting at address 0. Branches are resolved in Execute,
    so a taken branch flushes two instructions. A load followed by an instruction that uses its result stalls for one cycle;
    every other dependency is forwarded.</p>`,
};

function headline(p, s) {
  if (p.halted) return p.halted === 'ecall' ? 'halted at ecall' : 'stopped on an illegal instruction';
  const bits = [];
  if (s.lwstall) bits.push('load-use stall');
  if (s.pcSrc) bits.push('branch taken: flush');
  if (s.forwardA || s.forwardB) bits.push('forwarding');
  if (s.stopFetch && !s.pcSrc) bits.push('draining');
  return bits.join(' · ') || 'flowing';
}

function explain(p, s) {
  if (p.halted === 'ecall') return '<b>Halted.</b> The ecall reached Writeback, so every instruction before it has finished.';
  if (p.halted) return '<b>Stopped.</b> An instruction the core does not implement reached Writeback.';
  const r = [];
  const nm = (i) => REG_NAMES[i];
  if (s.lwstall) {
    r.push(`<b>Load-use stall.</b> <code>${esc(dis(p.de))}</code> is in Execute and its value only exists after Memory, but ` +
      `<code>${esc(dis(p.fd))}</code> in Decode needs <code>${nm(p.de.rd)}</code>. Fetch and Decode hold for one cycle and a bubble goes into Execute.`);
  }
  if (s.pcSrc) {
    r.push(`<b>Redirect.</b> <code>${esc(dis(p.de))}</code> ${p.de.branch ? 'is a taken branch' : 'jumps'} to <code>${hx(s.target)}</code>. ` +
      'The two younger instructions (in Fetch and Decode) are on the wrong path, so they are flushed.');
  }
  const same = s.forwardA && s.forwardA === s.forwardB && p.de.rs1 === p.de.rs2;
  for (const [f, rs, which] of [[s.forwardA, p.de.rs1, same ? 'both operands' : 'first operand'], [same ? 0 : s.forwardB, p.de.rs2, 'second operand']]) {
    if (!f) continue;
    const from = f === 2 ? p.em : p.mw;
    r.push(`<b>Forwarding.</b> ${which === 'both operands' ? 'Both operands' : 'The ' + which} <code>${nm(rs)}</code> of <code>${esc(dis(p.de))}</code> ${which === 'both operands' ? 'come' : 'comes'} from ` +
      `<code>${esc(dis(from))}</code> in ${f === 2 ? 'Memory' : 'Writeback'} instead of the stale register file value.`);
  }
  if (s.haltD && !s.pcSrc) r.push('<b>ecall in Decode.</b> Fetch stops; the core halts when it reaches Writeback.');
  if (!r.length) {
    r.push(p.cycle === 0 ? '<b>Reset.</b> The pipeline is empty. Each clock fetches one instruction and moves every other one a stage forward.'
      : '<b>No hazards this cycle.</b> Every instruction moves one stage forward.');
  }
  return r.join('<br>');
}

// --- Datapath -----------------------------------------------------------

function datapath(m, s) {
  const p = m.p;
  const W = 166, G = 24, X0 = 8, Y0 = 46, H = 128;
  const xs = STAGES.map((_, i) => X0 + i * (W + G));
  const width = xs[4] + W + 8, height = Y0 + H + 70;
  const o = [`<svg class="diagram" viewBox="0 0 ${width} ${height}" role="img" aria-label="Five-stage pipeline datapath">`,
    `<defs>
      <marker id="rv-ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker>
      <pattern id="rv-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="6" fill="var(--bad)" opacity=".55"/></pattern>
    </defs>`];
  const live = !p.halted;
  const word = fetchWord(p.text, p.pcF);

  const ifLines = live && !p.halting
    ? [['pc', hx(p.pcF)], ['next', s.stallF ? 'hold' : s.pcSrc ? hx(s.target) : 'pc + 4']]
    : [['pc', hx(p.pcF)], ['', 'fetch stopped']];
  const stages = [
    { st: 'IF', instr: live && !p.halting ? disasm(word, p.pcF) : null, lines: ifLines, stall: live && s.stallF },
    { st: 'ID', x: p.fd, lines: idLines(p, s), stall: live && s.stallD },
    { st: 'EX', x: p.de, lines: exLines(p, s) },
    { st: 'MEM', x: p.em, lines: memLines(p, s) },
    { st: 'WB', x: p.mw, lines: wbLines(p, s) },
  ];
  stages.forEach((g, i) => {
    const x = xs[i];
    const instr = g.x ? dis(g.x) : g.instr;
    o.push(`<rect class="box" x="${x}" y="${Y0}" width="${W}" height="${H}" rx="6" ${g.stall ? 'stroke-dasharray="5 3" stroke-width="2"' : ''}/>`);
    o.push(`<rect x="${x}" y="${Y0}" width="${W}" height="4" rx="2" fill="${COLOR[g.st]}"/>`);
    o.push(`<text class="ttl" x="${x + 10}" y="${Y0 + 22}">${g.st}${g.stall ? ' · stall' : ''}</text>`);
    if (g.x && g.x.valid) o.push(`<text class="sub" x="${x + W - 10}" y="${Y0 + 22}" text-anchor="end">${hx(g.x.pc)}</text>`);
    o.push(`<text class="val" x="${x + 10}" y="${Y0 + 44}" style="font-size:12px">${instr ? esc(trim(instr, 21)) : '<tspan class="sub">bubble</tspan>'}</text>`);
    g.lines.forEach(([k, v, cls], j) => {
      const y = Y0 + 68 + j * 18;
      o.push(`<text class="sub" x="${x + 10}" y="${y}">${esc(k)}</text>`);
      o.push(`<text class="sub" x="${x + W - 10}" y="${y}" text-anchor="end" ${cls ? `style="fill:${cls};font-weight:600"` : ''}>${esc(v)}</text>`);
    });
  });

  // Pipeline registers between the stages, with flush marks.
  const regs = [['F/D', live && s.flushD, live && s.stallD], ['D/E', live && s.flushE, false], ['E/M', false, false], ['M/W', false, false]];
  regs.forEach(([name, flush, hold], i) => {
    const x = xs[i] + W + 4, w = G - 8;
    o.push(`<rect x="${x}" y="${Y0}" width="${w}" height="${H}" rx="3" fill="${flush ? 'url(#rv-hatch)' : 'var(--panel-2)'}" stroke="${flush ? 'var(--bad)' : hold ? 'var(--muted)' : 'var(--line)'}"/>`);
    o.push(`<text class="sub" x="${x + w / 2}" y="${Y0 - 6}" text-anchor="middle">${name}</text>`);
    if (flush) o.push(`<text class="sub" x="${x + w / 2}" y="${Y0 + H + 14}" text-anchor="middle" style="fill:var(--bad);font-weight:600">flush</text>`);
    else if (hold) o.push(`<text class="sub" x="${x + w / 2}" y="${Y0 + H + 14}" text-anchor="middle">hold</text>`);
  });

  if (live) {
    // Branch / jump redirect: Execute back to Fetch, over the top.
    if (s.pcSrc) {
      const a = xs[2] + W / 2, b = xs[0] + W / 2;
      o.push(`<path d="M${a},${Y0} C${a},${Y0 - 34} ${b},${Y0 - 34} ${b},${Y0 - 2}" fill="none" stroke="var(--bad)" stroke-width="2" marker-end="url(#rv-ah)"/>`);
      o.push(`<text class="sub" x="${(a + b) / 2}" y="${Y0 - 30}" text-anchor="middle" style="fill:var(--bad);font-weight:600">pc ← ${hx(s.target)}</text>`);
    }
    // Forwarding paths: Memory / Writeback back into Execute, underneath.
    const bottom = Y0 + H;
    const fwd = [];
    if (s.forwardA) fwd.push([s.forwardA, 'A']);
    if (s.forwardB) fwd.push([s.forwardB, 'B']);
    fwd.forEach(([f, op], k) => {
      const from = xs[f === 2 ? 3 : 4] + W / 2 + (k ? 14 : -14), to = xs[2] + W / 2 + (op === 'A' ? -20 : 20);
      const dip = bottom + 30 + k * 16;
      o.push(`<path d="M${from},${bottom} L${from},${dip} L${to},${dip} L${to},${bottom + 2}" fill="none" stroke="var(--drive)" stroke-width="2" marker-end="url(#rv-ah)"/>`);
      o.push(`<text class="sub" x="${(from + to) / 2}" y="${dip - 4}" text-anchor="middle" style="fill:var(--drive);font-weight:600">${op} ← ${f === 2 ? 'MEM' : 'WB'}</text>`);
    });
  }
  o.push('</svg>');
  return o.join('');
}

const trim = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const nm = (i) => `${REG_NAMES[i]}`;

function idLines(p, s) {
  if (!p.fd.valid) return [];
  if (p.halted) return [];
  const d = s.dec, out = [];
  if (d.halt) return [['', d.name === null && d.halt === 2 ? 'illegal: halt at WB' : 'stop fetching']];
  if (d.rs1) out.push([`read ${nm(d.rs1)}`, hx(s.rd1D)]);
  if (d.rs2) out.push([`read ${nm(d.rs2)}`, hx(s.rd2D)]);
  if (d.rd) out.push(['dest', nm(d.rd)]);
  if (s.lwstall) out.push(['hazard', 'load-use', 'var(--bad)']);
  return out;
}

function exLines(p, s) {
  const e = p.de;
  if (!e.valid || p.halted) return [];
  const out = [];
  const src = (f) => (f === 2 ? 'var(--drive)' : f === 1 ? 'var(--drive)' : null);
  if (e.rs1) out.push([`A ${nm(e.rs1)}${s.forwardA ? (s.forwardA === 2 ? ' ⟵M' : ' ⟵W') : ''}`, hx(s.fwdA), src(s.forwardA)]);
  if (e.rs2) out.push([`B ${nm(e.rs2)}${s.forwardB ? (s.forwardB === 2 ? ' ⟵M' : ' ⟵W') : ''}`, hx(s.fwdB), src(s.forwardB)]);
  if (e.branch) out.push(['branch', s.pcSrc ? `taken → ${hx(s.target)}` : 'not taken', s.pcSrc ? 'var(--bad)' : null]);
  else if (e.jump) out.push(['jump', hx(s.target), 'var(--bad)']);
  if (e.name && !e.branch) out.push([e.memRead || e.memWrite ? 'address' : 'result', hx(s.exResultE)]);
  return out;
}

function memLines(p, s) {
  const e = p.em;
  if (!e.valid || p.halted) return [];
  if (e.memRead) return [['load', hx(s.exResultM)], ['value', hx(s.loadM)]];
  if (e.memWrite) return [['store', hx(s.exResultM)], ['data', hx(s.wd)], ['bytes', s.be.toString(2).padStart(4, '0')]];
  if (e.regWrite && e.rd) return [['result', hx(s.exResultM)]];
  return [];
}

function wbLines(p, s) {
  const e = p.mw;
  if (!e.valid) return [];
  if (p.halted) return [['', 'halt']];
  if (s.regWriteW && s.rdW) return [[`${nm(s.rdW)} ←`, hx(s.resultW), 'var(--ok)'], ['from', e.memRead ? 'memory' : 'ALU']];
  return [['', 'no register write']];
}

// --- Pipeline chart -------------------------------------------------------

function chart(m, records) {
  const p = m.p;
  const cols = records.slice(-CHART_COLS);
  if (!cols.length) return '';
  const first = records.length - cols.length;
  const live = new Set([p.fd, p.de, p.em, p.mw].filter((x) => x.valid).map((x) => x.seq));
  const seqs = new Set();
  for (const r of cols) for (const k of ['D', 'E', 'M', 'W']) if (r[k]) seqs.add(r[k]);
  const rows = [...seqs].sort((a, b) => a - b);
  const last = cols.length - 1;

  const head = cols.map((r, i) => `<th class="${i === last ? 'now' : ''}">${r.cycle}</th>`).join('');
  const body = rows.map((seq) => {
    const info = m.seqInfo.get(seq);
    const reachedW = records.some((r) => r.W === seq);
    const flushed = !reachedW && !live.has(seq);
    let lastSeen = -1;
    const cells = cols.map((r, i) => {
      const prev = records[first + i - 1], next = records[first + i + 1];
      let st = null, stall = false;
      if (r.W === seq) st = 'WB';
      else if (r.M === seq) st = 'MEM';
      else if (r.E === seq) st = 'EX';
      else if (r.D === seq) { st = 'ID'; stall = !!(prev && prev.D === seq); }
      else if (next && next.D === seq && !(r.D === seq)) st = 'IF';
      if (st) lastSeen = i;
      const now = i === last ? ' now' : '';
      if (!st) return '<td class="cell"></td>';
      return `<td class="cell st-${st}${stall ? ' stall' : ''}${now}" title="${st}${stall ? ' (stalled)' : ''}">${st}</td>`;
    });
    if (flushed && lastSeen >= 0 && lastSeen + 1 < cols.length) {
      cells[lastSeen + 1] = `<td class="cell fl${lastSeen + 1 === last ? ' now' : ''}" title="flushed"></td>`;
    }
    const text = info ? disasm(info.word, info.pc) : '?';
    return `<tr><td class="instr${flushed ? ' flushed' : ''}" title="${hx(info?.pc ?? 0)}">${esc(text)}</td>${cells.join('')}</tr>`;
  });
  // The instruction being fetched right now has no number yet.
  if (!p.halted && !p.halting) {
    const cells = cols.map((_, i) => (i === last ? '<td class="cell st-IF now" title="IF">IF</td>' : '<td class="cell"></td>'));
    body.push(`<tr><td class="instr" title="${hx(p.pcF)}">${esc(disasm(fetchWord(p.text, p.pcF), p.pcF))}</td>${cells.join('')}</tr>`);
  }
  return `<table class="pchart"><thead><tr><th style="text-align:left">instruction \\ cycle</th>${head}</tr></thead><tbody>${body.join('')}</tbody></table>`;
}

// --- State tables -----------------------------------------------------------

function regFile(m) {
  const r = m.p.regs;
  const cells = [];
  for (let i = 0; i < 32; i++) {
    const v = r[i];
    const cls = [i === m.lastWrite ? 'changed' : '', v === 0 ? 'zero' : ''].join(' ');
    cells.push(`<div class="${cls}" title="x${i} = ${v} (unsigned ${v >>> 0})"><span>x${i} ${REG_NAMES[i]}</span><span>${h8(v)}</span></div>`);
  }
  return `<div class="regs">${cells.join('')}</div>`;
}

function dataMem(m) {
  const mem = m.p.mem, init = m.program.data.length;
  const rows = [];
  for (let i = 0; i < 1024 && rows.length < 256; i++) {
    const v = mem.word(i);
    if (v === 0 && i * 4 >= init && i * 4 !== m.lastStore) continue;
    rows.push(`<tr class="${i * 4 === m.lastStore ? 'pc' : ''}"><td>${h8(i * 4).slice(4)}</td><td>${h8(v)}</td><td class="dim">${v}</td></tr>`);
  }
  if (!rows.length) return '<p class="empty">All zero. Stores show up here.</p>';
  return `<table class="grid"><thead><tr><th>Addr</th><th>Word</th><th>Signed</th></tr></thead><tbody>${rows.join('')}</tbody></table>
    <p class="sub" style="color:var(--muted);margin:6px 0 0">Zero words outside the .data section are hidden.</p>`;
}

function listing(m) {
  const p = m.p, text = m.program.text;
  if (!text.length) return '<p class="empty">No instructions.</p>';
  const at = new Map();
  const put = (st, pc) => { if (pc == null) return; (at.get(pc) || at.set(pc, []).get(pc)).push(st); };
  if (!p.halted && !p.halting) put('IF', p.pcF);
  for (const [st, x] of [['ID', p.fd], ['EX', p.de], ['MEM', p.em], ['WB', p.mw]]) if (x.valid) put(st, x.pc);
  const rows = Array.from(text, (w, i) => {
    const pc = i * 4, st = at.get(pc) || [];
    const badges = st.map((t) => `<span class="badge" style="background:${COLOR[t]}">${t}</span>`).join(' ');
    return `<tr class="${st.length ? 'pc' : ''}"><td>${h8(pc).slice(4)}</td><td class="dim">${h8(w)}</td><td>${esc(disasm(w, pc))}</td><td>${badges}</td></tr>`;
  });
  return `<table class="grid"><thead><tr><th>Addr</th><th>Word</th><th>Instruction</th><th>Stage</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

function wave(records) {
  const rs = records.filter((r) => r.sig);
  if (!rs.length) return '<p class="empty">Clock the CPU to draw its signals.</p>';
  const bit = (n, k = n) => ({ name: n, kind: 'bit', values: rs.map((r) => r.sig[k]) });
  const fw = ['–', 'WB', 'MEM'];
  return waveform({
    labels: rs.map((r) => r.label),
    signals: [
      bit('stallF'), bit('stallD'), bit('flushD'), bit('flushE'), bit('pcSrc'),
      { name: 'fwdA', kind: 'bus', values: rs.map((r) => (r.sig.forwardA ? fw[r.sig.forwardA] : null)) },
      { name: 'fwdB', kind: 'bus', values: rs.map((r) => (r.sig.forwardB ? fw[r.sig.forwardB] : null)) },
      bit('regWrW', 'regWriteW'),
    ],
  });
}
