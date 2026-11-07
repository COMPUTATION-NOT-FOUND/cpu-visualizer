// SAP-1 in the browser: the machine adapter used by app.js and its views.
import { assemble, disasm, OPCODES, MEM_SIZE } from '../sap1/asm.js';
import { SAP1, CTL_NAMES } from '../sap1/sim.js';
import { waveform } from './wave.js';

const hex = (v, n = 2) => v.toString(16).toUpperCase().padStart(n, '0');
const bin = (v, n = 8) => v.toString(2).padStart(n, '0');
const OPNAME = Object.fromEntries(Object.entries(OPCODES).map(([k, v]) => [v, k]));

// Which module drives the bus, and which modules load from it, for each control bit.
const LOADS = { LM: 'MAR', LI: 'IR', LA: 'A', LB: 'B', LO: 'OUT' };

function describe(sim) {
  if (sim.halted) return '<b>Halted.</b> The ring counter is frozen, so nothing changes on later clocks.';
  const op = sim.ir >> 4, name = OPNAME[op] || 'NOP';
  const fetch = [
    '<b>T0 · address state.</b> The PC drives the bus and the MAR loads it: the next instruction\'s address.',
    '<b>T1 · increment state.</b> The PC counts up by one. The bus is idle.',
    '<b>T2 · memory state.</b> RAM[MAR] drives the bus and the IR loads it: the instruction is fetched.',
  ];
  if (sim.t < 3) return fetch[sim.t];
  const k = `<b>T${sim.t} · execute ${name}.</b> `;
  const idle = `${k}Nothing happens in this state; ${name} needs fewer than three execute states.`;
  const steps = {
    LDA: ['The IR\'s low nibble (the operand address) goes to the MAR.', 'RAM[MAR] goes into A.', null],
    ADD: ['The IR\'s low nibble (the operand address) goes to the MAR.', 'RAM[MAR] goes into B.', 'The ALU adds: A + B goes back into A.'],
    SUB: ['The IR\'s low nibble (the operand address) goes to the MAR.', 'RAM[MAR] goes into B.', 'The ALU subtracts: A − B goes back into A.'],
    OUT: ['A goes into the output register.', null, null],
    HLT: ['HLT stops the ring counter on this clock.', null, null],
  }[name];
  if (!steps) return `${k}Opcode ${hex(op, 1)} isn't an SAP-1 instruction, so it does nothing after the fetch.`;
  const s = steps[sim.t - 3];
  return s ? k + s : idle;
}

export const sap1Machine = {
  id: 'sap1',
  clock: 'T-state',
  defaultExample: 'add-sub',
  maxClocks: 6 * 4096,

  assemble(source) {
    const r = assemble(source);
    return { errors: r.errors, program: r };
  },

  create(program) {
    const sim = new SAP1(program.mem);
    return { sim, program, instrAddr: 0 };
  },

  step(m) {
    if (m.sim.halted) return false;
    if (m.sim.t === 0) m.instrAddr = m.sim.pc;
    m.sim.step();
    return true;
  },

  instrStep(m) {
    if (m.sim.halted) return false;
    do this.step(m); while (!m.sim.halted && m.sim.t !== 0);
    return true;
  },

  done: (m) => m.sim.halted,
  clocks: (m) => m.sim.steps,

  snapshot(m) {
    const s = m.sim;
    return {
      t: s.t, halted: s.halted, pc: s.pc, mar: s.mar, ir: s.ir, a: s.a, b: s.b, out: s.out,
      steps: s.steps, instrs: s.instrs, outputs: s.outputs.slice(), mem: s.mem.slice(), instrAddr: m.instrAddr,
    };
  },

  restore(m, snap) {
    const { instrAddr, outputs, mem, ...rest } = snap;
    Object.assign(m.sim, rest);
    m.sim.outputs = outputs.slice();
    m.sim.mem = mem.slice();
    m.instrAddr = instrAddr;
    m.sim.comb();
  },

  record(m) {
    const s = m.sim;
    return { label: `T${s.t}`, ctl: { ...s.ctl }, bus: s.bus, busSource: s.busSource };
  },

  status(m) {
    const s = m.sim;
    const state = s.halted ? '<b class="halt">halted</b>' : `<b>T${s.t}</b>`;
    return `${state} · clock <b>${s.steps}</b> · instructions <b>${s.instrs}</b>`;
  },

  marks(m) {
    const s = m.sim, lineOf = m.program.lineOf;
    const hl = new Map(), tags = new Map();
    const cur = s.t === 0 && !s.halted ? s.pc : m.instrAddr;
    if (lineOf[cur] > 0) {
      hl.set(lineOf[cur], 'hl-cur');
      tags.set(lineOf[cur], [{ text: s.halted ? 'HLT' : `T${s.t}`, color: 'var(--accent)' }]);
    }
    if (!s.halted && s.t >= 3 && s.mar !== cur && lineOf[s.mar] > 0 && (s.t === 4 || s.ctl.LM)) {
      hl.set(lineOf[s.mar], 'hl-op');
    }
    return { highlights: hl, tags };
  },

  render(root, m, records) {
    const s = m.sim;
    root.innerHTML = `
      <div class="card"><h2>Datapath <span>${s.busSource ? `${s.busSource} drives the bus` : 'bus idle'}</span></h2>
        <div class="card-body">${diagram(s)}
          <div class="legend"><span><i style="background:var(--drive)"></i>drives the bus</span>
            <span><i style="background:var(--load)"></i>loads on the next clock edge</span></div>
        </div>
        <p class="explain" style="margin:0 10px 10px">${describe(s)}</p>
      </div>
      <div class="row2">
        <div class="card"><h2>RAM <span>16 × 8 bits</span></h2><div class="card-body">${ramTable(m)}</div></div>
        <div class="card"><h2>Output</h2><div class="card-body">
          ${s.outputs.length ? `<div class="outputs">${s.outputs.map((v) => `<span title="0x${hex(v)}">${v}</span>`).join('')}</div>`
            : '<p class="empty">Nothing yet. OUT copies A here.</p>'}
          <p class="sub" style="color:var(--muted);margin:10px 0 0">Each instruction takes 6 T-states: 3 to fetch it, 3 to execute it.</p>
        </div></div>
      </div>
      <div class="card"><h2>Timing <span>last ${Math.min(records.length, 40)} clocks</span></h2>
        <div class="card-body">${wave(records.slice(-40))}</div></div>`;
  },

  reference: `<summary>SAP-1 instruction set</summary>
    <table>
      <tr><th>Instruction</th><th>Opcode</th><th>Does</th></tr>
      <tr><td>LDA addr</td><td>0</td><td>A ← RAM[addr]</td></tr>
      <tr><td>ADD addr</td><td>1</td><td>B ← RAM[addr]; A ← A + B</td></tr>
      <tr><td>SUB addr</td><td>2</td><td>B ← RAM[addr]; A ← A − B</td></tr>
      <tr><td>OUT</td><td>E</td><td>OUT ← A</td></tr>
      <tr><td>HLT</td><td>F</td><td>stop the clock</td></tr>
      <tr><td>.byte v[, v…]</td><td></td><td>data bytes</td></tr>
      <tr><td>.org addr</td><td></td><td>continue at addr</td></tr>
    </table>
    <p>16 bytes of RAM hold both code and data. Addresses are 0–15 or a label. Numbers can be 42, 0x2A, 2Ah or 0b101010. Comments start with ; or #.</p>`,
};

function box(x, y, w, h, title, value, sub, cls = '') {
  return `<g><rect class="box ${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>
    <text class="ttl" x="${x + 10}" y="${y + 18}">${title}</text>
    <text class="val" x="${x + w - 10}" y="${y + 19}" text-anchor="end">${value}</text>
    ${sub ? `<text class="sub" x="${x + 10}" y="${y + h - 9}">${sub}</text>` : ''}</g>`;
}

function diagram(s) {
  const c = s.ctl;
  const drives = { PC: c.Ep, RAM: c.CE, IR: c.EI, A: c.EA, ALU: c.EU };
  const loads = { MAR: c.LM, IR: c.LI, A: c.LA, B: c.LB, OUT: c.LO };
  const cls = (n) => (drives[n] && loads[n] ? 'both' : drives[n] ? 'drive' : loads[n] ? 'load' : '');
  const BX = 360, W = 220, H = 58;
  const L = 70, R = 430;
  const rows = [40, 120, 200, 280, 360];
  const busActive = !!s.busSource;
  const o = [`<svg class="diagram" viewBox="0 0 720 470" role="img" aria-label="SAP-1 datapath: bus value ${hex(s.bus)}">`,
    `<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker></defs>`];

  // Bus.
  o.push(`<line class="bus ${busActive ? 'active' : ''}" x1="${BX}" y1="30" x2="${BX}" y2="${rows[4] + H}"/>`);
  o.push(`<text class="bus-val" x="${BX}" y="20" text-anchor="middle">W bus = ${busActive ? `${hex(s.bus)}h` : '—'}</text>`);

  // A connection from a module to the bus, styled by what it is doing.
  const tap = (n, y, left) => {
    const x1 = left ? L + W : R, x2 = BX + (left ? -5 : 5), ym = y + H / 2;
    if (drives[n] && !loads[n]) return `<line class="wire drive" x1="${x1}" y1="${ym}" x2="${x2}" y2="${ym}" marker-end="url(#ah)"/>`;
    if (loads[n]) return `<line class="wire load" x1="${x2}" y1="${ym}" x2="${x1}" y2="${ym}" marker-end="url(#ah)"/>`;
    return `<line class="wire" x1="${x1}" y1="${ym}" x2="${x2}" y2="${ym}"/>`;
  };

  const op = s.ir >> 4;
  // Left column.
  o.push(box(L, rows[0], W, H, 'Program counter', `${hex(s.pc, 1)}h`, `${bin(s.pc, 4)}${c.Cp ? ' · counting up' : ''}`, cls('PC') + (c.Cp ? ' load' : '')));
  o.push(tap('PC', rows[0], true));
  o.push(box(L, rows[1], W, H, 'MAR', `${hex(s.mar, 1)}h`, `${bin(s.mar, 4)} · address`, cls('MAR')));
  o.push(tap('MAR', rows[1], true));
  o.push(box(L, rows[2], W, H, 'RAM', `${hex(s.mem[s.mar])}h`, `[${hex(s.mar, 1)}] = ${bin(s.mem[s.mar])}`, cls('RAM')));
  o.push(tap('RAM', rows[2], true));
  o.push(`<line class="wire" x1="${L + W / 2}" y1="${rows[1] + H}" x2="${L + W / 2}" y2="${rows[2] - 2}" marker-end="url(#ah)"/>`);
  o.push(box(L, rows[3], W, H, 'Instruction reg.', `${hex(s.ir)}h`, `${bin(s.ir >> 4, 4)} ${bin(s.ir & 15, 4)} · ${disasm(s.ir)}`, cls('IR')));
  o.push(tap('IR', rows[3], true));
  o.push(`<line class="wire" x1="${L + W / 2}" y1="${rows[3] + H}" x2="${L + W / 2}" y2="${rows[4] - 2}" marker-end="url(#ah)"/>`);
  o.push(`<text class="sub" x="${L + W / 2 + 6}" y="${rows[3] + H + 14}">opcode ${hex(op, 1)}h</text>`);

  // Controller with the ring counter.
  o.push(`<rect class="box" x="${L}" y="${rows[4]}" width="${W}" height="${H}" rx="6"/>`);
  o.push(`<text class="ttl" x="${L + 10}" y="${rows[4] + 18}">Controller</text>`);
  for (let t = 0; t < 6; t++) {
    const on = !s.halted && s.t === t;
    const cx = L + 22 + t * 34, cy = rows[4] + 38;
    o.push(`<circle class="ring ${on ? 'on' : ''}" cx="${cx}" cy="${cy}" r="12"/>`);
    o.push(`<text class="ring-t ${on ? 'on' : ''}" x="${cx}" y="${cy + 4}" text-anchor="middle">T${t}</text>`);
  }

  // Right column.
  o.push(box(R, rows[0], W, H, 'Accumulator A', `${hex(s.a)}h`, `${bin(s.a)} = ${s.a}`, cls('A')));
  o.push(tap('A', rows[0], false));
  o.push(box(R, rows[1], W, H, c.SU ? 'ALU (A − B)' : 'ALU (A + B)', `${hex(s.alu)}h`, `${bin(s.alu)} = ${s.alu}`, cls('ALU')));
  o.push(tap('ALU', rows[1], false));
  o.push(`<line class="wire" x1="${R + W / 2}" y1="${rows[0] + H}" x2="${R + W / 2}" y2="${rows[1] - 2}" marker-end="url(#ah)"/>`);
  o.push(box(R, rows[2], W, H, 'B register', `${hex(s.b)}h`, `${bin(s.b)} = ${s.b}`, cls('B')));
  o.push(tap('B', rows[2], false));
  o.push(`<line class="wire" x1="${R + W / 2}" y1="${rows[2]}" x2="${R + W / 2}" y2="${rows[1] + H + 2}" marker-end="url(#ah)"/>`);
  o.push(box(R, rows[3], W, H, 'Output register', `${hex(s.out)}h`, `${bin(s.out)}`, cls('OUT')));
  o.push(tap('OUT', rows[3], false));
  o.push(`<line class="wire" x1="${R + W / 2}" y1="${rows[3] + H}" x2="${R + W / 2}" y2="${rows[4] - 2}" marker-end="url(#ah)"/>`);
  o.push(box(R, rows[4], W, H, 'Display', String(s.out), 'decimal', ''));

  // Control word along the bottom.
  const cw = [...CTL_NAMES, 'HLT'];
  const y0 = rows[4] + H + 18, step = 720 / cw.length;
  cw.forEach((n, i) => {
    const on = !!c[n], x = i * step + step / 2;
    o.push(`<rect class="${on ? 'bit-on' : 'bit-off'}" x="${x - 14}" y="${y0}" width="28" height="6" rx="2"/>`);
    o.push(`<text class="bit-lbl ${on ? 'on' : ''}" x="${x}" y="${y0 + 20}" text-anchor="middle">${n}</text>`);
  });
  o.push('</svg>');
  return o.join('');
}

function ramTable(m) {
  const s = m.sim;
  const cur = s.t === 0 ? s.pc : m.instrAddr;
  const rows = [];
  for (let a = 0; a < MEM_SIZE; a++) {
    const v = s.mem[a];
    const tag = [a === s.pc ? '<span class="badge" style="background:var(--accent)">PC</span>' : '',
      a === s.mar ? '<span class="badge" style="background:var(--drive)">MAR</span>' : ''].join(' ');
    rows.push(`<tr class="${!s.halted && a === cur ? 'pc' : ''} ${a === s.mar ? 'mar' : ''}">
      <td>${hex(a, 1)}</td><td>${hex(v)}</td><td>${bin(v >> 4, 4)} ${bin(v & 15, 4)}</td>
      <td>${disasm(v)}</td><td class="dim">${v}</td><td>${tag}</td></tr>`);
  }
  return `<table class="grid"><thead><tr><th>Addr</th><th>Hex</th><th>Binary</th><th>As code</th><th>As data</th><th></th></tr></thead>
    <tbody>${rows.join('')}</tbody></table>`;
}

function wave(records) {
  if (!records.length) return '<p class="empty">Clock the CPU to draw its signals.</p>';
  const sigs = ['Ep', 'LM', 'Cp', 'CE', 'LI', 'EI', 'LA', 'EA', 'LB', 'SU', 'EU', 'LO', 'HLT'];
  return waveform({
    labels: records.map((r) => r.label),
    signals: [
      { name: 'bus', kind: 'bus', values: records.map((r) => (r.busSource ? r.bus : null)) },
      ...sigs.map((n) => ({ name: n, kind: 'bit', values: records.map((r) => r.ctl[n]) })),
    ],
    fmt: (v) => (v == null ? '' : hex(v)),
  });
}
