// SAP-1 T-state model. Mirrors rtl/sap1 exactly: step() is one clock, and
// traceLine() prints the same line as sim/tb_sap1.sv.
import { OPCODES } from './asm.js';

export const CTL_NAMES = ['Cp', 'Ep', 'LM', 'CE', 'LI', 'EI', 'LA', 'EA', 'SU', 'EU', 'LB', 'LO'];
const hex = (v, n) => v.toString(16).padStart(n, '0');

export class SAP1 {
  constructor(mem) {
    this.mem = Uint8Array.from(mem);
    this.reset();
  }

  reset() {
    this.t = 0; this.halted = false;
    this.pc = 0; this.mar = 0; this.ir = 0; this.a = 0; this.b = 0; this.out = 0;
    this.steps = 0; this.instrs = 0;
    this.outputs = [];          // every value OUT has written, in order
    this.comb();
  }

  // Control word and bus for the current T-state (the RTL's always_comb blocks).
  comb() {
    const c = { Cp: 0, Ep: 0, LM: 0, CE: 0, LI: 0, EI: 0, LA: 0, EA: 0, SU: 0, EU: 0, LB: 0, LO: 0, HLT: 0 };
    const op = this.ir >> 4;
    if (!this.halted) {
      const mem3 = op === OPCODES.LDA || op === OPCODES.ADD || op === OPCODES.SUB;
      switch (this.t) {
        case 0: c.Ep = c.LM = 1; break;
        case 1: c.Cp = 1; break;
        case 2: c.CE = c.LI = 1; break;
        case 3:
          if (mem3) c.EI = c.LM = 1;
          else if (op === OPCODES.OUT) c.EA = c.LO = 1;
          else if (op === OPCODES.HLT) c.HLT = 1;
          break;
        case 4:
          if (op === OPCODES.LDA) c.CE = c.LA = 1;
          else if (op === OPCODES.ADD || op === OPCODES.SUB) c.CE = c.LB = 1;
          break;
        case 5:
          if (op === OPCODES.ADD) c.EU = c.LA = 1;
          else if (op === OPCODES.SUB) c.EU = c.SU = c.LA = 1;
          break;
      }
    }
    const alu = (c.SU ? this.a - this.b : this.a + this.b) & 0xff;
    let bus = 0, source = null;
    if (c.Ep) { bus = this.pc; source = 'PC'; }
    if (c.CE) { bus = this.mem[this.mar]; source = 'RAM'; }
    if (c.EI) { bus = this.ir & 0xf; source = 'IR'; }
    if (c.EA) { bus = this.a; source = 'A'; }
    if (c.EU) { bus = alu; source = 'ALU'; }
    this.ctl = c;
    this.bus = bus;
    this.busSource = source;
    this.alu = alu;
    return c;
  }

  ctlWord() {
    return CTL_NAMES.reduce((w, n) => (w << 1) | this.ctl[n], 0);
  }

  traceLine() {
    return `${this.steps} T${this.t} ctl=${hex(this.ctlWord(), 3)} bus=${hex(this.bus, 2)} pc=${hex(this.pc, 1)} ` +
      `mar=${hex(this.mar, 1)} ir=${hex(this.ir, 2)} a=${hex(this.a, 2)} b=${hex(this.b, 2)} out=${hex(this.out, 2)}` +
      (this.ctl.HLT ? ' hlt' : '');
  }

  // One rising clock edge.
  step() {
    if (this.halted) return false;
    const c = this.ctl, bus = this.bus;
    if (this.t === 2) this.instrs++;
    if (c.Cp) this.pc = (this.pc + 1) & 0xf;
    if (c.LM) this.mar = bus & 0xf;
    if (c.LI) this.ir = bus;
    if (c.LA) this.a = bus;
    if (c.LB) this.b = bus;
    if (c.LO) { this.out = bus; this.outputs.push(bus); }
    if (c.HLT) this.halted = true;
    this.t = this.t === 5 ? 0 : this.t + 1;
    this.steps++;
    this.comb();
    return true;
  }

  // Runs until HLT or maxSteps T-states; onStep(sim) is called before each edge.
  run(maxSteps = 10000, onStep) {
    while (!this.halted && this.steps < maxSteps) {
      if (onStep) onStep(this);
      this.step();
    }
    return this;
  }
}

// Instruction-level reference: what each instruction should do, with no T-states.
export function reference(mem, maxInstrs = 2000) {
  let pc = 0, a = 0, b = 0, out = 0, instrs = 0;
  const outputs = [];
  while (instrs < maxInstrs) {
    const ir = mem[pc]; pc = (pc + 1) & 0xf; instrs++;
    const op = ir >> 4, addr = ir & 0xf;
    if (op === OPCODES.LDA) a = mem[addr];
    else if (op === OPCODES.ADD) { b = mem[addr]; a = (a + b) & 0xff; }
    else if (op === OPCODES.SUB) { b = mem[addr]; a = (a - b) & 0xff; }
    else if (op === OPCODES.OUT) { out = a; outputs.push(a); }
    else if (op === OPCODES.HLT) return { a, b, out, pc, instrs, outputs, halted: true };
  }
  return { a, b, out, pc, instrs, outputs, halted: false };
}
