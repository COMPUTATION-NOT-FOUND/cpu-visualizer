// Cycle-accurate model of rtl/rv32i/rv_core.sv.
// Every signal here has the same name (minus the stage suffix style) as in the RTL,
// and tools/check.mjs compares this model's trace with the Icarus trace line by line.

import { decode } from './isa.js';
import { DataMemory, fetchWord, aluOp, branchTaken } from './iss.js';

const HALT_NONE = 0, HALT_ECALL = 1, HALT_ILLEGAL = 2;

// An empty pipeline slot. Matches a cleared pipeline register in the RTL (all zero).
function bubble() {
  return {
    valid: false, seq: 0, pc: 0, word: 0, name: null, fmt: null,
    rs1: 0, rs2: 0, rd: 0, imm: 0, f3: 0,
    regWrite: false, memRead: false, memWrite: false,
    jump: false, jalr: false, branch: false, halt: HALT_NONE,
  };
}

// Decode stage: the control the RTL decoder produces for this F/D register.
function decodeStage(fd) {
  const s = bubble();
  if (!fd.valid) return s;
  s.valid = true; s.seq = fd.seq; s.pc = fd.pc; s.word = fd.word;
  const d = decode(fd.word);
  if (!d) { s.halt = HALT_ILLEGAL; return s; }
  s.name = d.name; s.fmt = d.fmt;
  if (d.name === 'ecall' || d.name === 'ebreak') { s.halt = HALT_ECALL; return s; }
  if (d.name === 'fence') return s;
  s.rs1 = d.rs1; s.rs2 = d.rs2; s.imm = d.imm; s.f3 = d.f3;
  s.regWrite = !(d.fmt === 'B' || d.fmt === 'S');
  s.memRead = d.fmt === 'L';
  s.memWrite = d.fmt === 'S';
  s.jump = d.name === 'jal' || d.name === 'jalr';
  s.jalr = d.name === 'jalr';
  s.branch = d.fmt === 'B';
  s.rd = s.regWrite ? d.rd : 0;
  return s;
}

const hex8 = (v) => (v >>> 0).toString(16).padStart(8, '0');

export class Pipeline {
  constructor(program) {
    this.text = program.text;
    this.data = program.data;
    this.reset();
  }

  reset() {
    this.pcF = 0;
    this.fd = { valid: false, seq: 0, pc: 0, word: 0 };
    this.fetchSeq = 0; // numbers each fetch, for the UI's pipeline chart (not in the RTL)
    this.de = bubble();
    this.em = { ...bubble(), exResult: 0, writeData: 0 };
    this.mw = { ...bubble(), exResult: 0, load: 0 };
    this.regs = new Int32Array(32);
    this.mem = new DataMemory(this.data);
    this.halting = false;
    this.halted = null; // null | 'ecall' | 'illegal'
    this.cycle = 0;
    this.retired = 0;
    this.sig = null; // combinational signals of the current cycle
  }

  // All combinational logic for the current register state.
  comb() {
    const { fd, de, em, mw, regs } = this;
    const s = {};

    // Writeback
    s.regWriteW = mw.regWrite;
    s.rdW = mw.rd;
    s.resultW = mw.memRead ? mw.load : mw.exResult;

    // Decode (register file reads see this cycle's write)
    const dec = decodeStage(fd);
    const rf = (r) => (r === 0 ? 0 : s.regWriteW && s.rdW === r ? s.resultW : regs[r]);
    s.dec = dec;
    s.rd1D = rf(dec.rs1);
    s.rd2D = rf(dec.rs2);

    // Memory
    s.exResultM = em.exResult;
    const off = em.exResult & 3;
    if ((em.f3 & 3) === 0) { s.be = 1 << off; s.wd = (em.writeData & 0xff) * 0x01010101 | 0; }
    else if ((em.f3 & 3) === 1) { s.be = off & 2 ? 0xc : 0x3; s.wd = (em.writeData & 0xffff) * 0x10001 | 0; }
    else { s.be = 0xf; s.wd = em.writeData; }
    s.loadM = em.memRead ? this.mem.load(em.exResult, em.f3) : 0;

    // Forwarding into Execute
    const fwd = (r) => (r !== 0 && em.regWrite && r === em.rd ? 2 : r !== 0 && s.regWriteW && r === s.rdW ? 1 : 0);
    s.forwardA = fwd(de.rs1);
    s.forwardB = fwd(de.rs2);
    const pick = (f, v) => (f === 2 ? s.exResultM : f === 1 ? s.resultW : v);
    const a = pick(s.forwardA, de.rv1 | 0);
    const b = pick(s.forwardB, de.rv2 | 0);
    s.fwdA = a; s.fwdB = b;

    // Execute
    let alu = 0, taken = false;
    switch (de.fmt) {
      case 'U': alu = de.name === 'lui' ? de.imm : (de.pc + de.imm) | 0; break;
      case 'R': alu = aluOp(de.name, a, b); break;
      case 'I': alu = de.jalr ? (a + de.imm) | 0 : aluOp(de.name, a, de.imm); break;
      case 'SH': alu = aluOp(de.name, a, de.imm); break;
      case 'L': case 'S': alu = (a + de.imm) | 0; break;
      case 'B': taken = branchTaken(de.name, a, b); break;
      default: break;
    }
    s.pcSrc = (de.branch && taken) || de.jump;
    s.target = de.jalr ? alu & ~1 : (de.pc + de.imm) | 0;
    s.exResultE = de.jump ? (de.pc + 4) | 0 : alu;

    // Hazards
    s.lwstall = de.memRead && de.rd !== 0 && (dec.rs1 === de.rd || dec.rs2 === de.rd);
    s.haltD = dec.halt !== HALT_NONE;
    s.stopFetch = (s.haltD && !s.pcSrc) || this.halting;
    s.stallF = s.lwstall || s.stopFetch;
    s.stallD = s.lwstall;
    s.flushD = s.pcSrc || s.stopFetch;
    s.flushE = s.pcSrc || s.lwstall;
    return s;
  }

  // One rising clock edge.
  edge() {
    const s = this.comb();
    const { de, em, mw } = this;

    if (s.regWriteW && s.rdW !== 0) this.regs[s.rdW] = s.resultW;
    if (em.memWrite) this.mem.store(em.exResult, em.f3, em.writeData);
    if (mw.valid && mw.halt !== HALT_NONE && !this.halted) this.halted = mw.halt === HALT_ECALL ? 'ecall' : 'illegal';
    if (s.haltD && !s.pcSrc) this.halting = true;

    this.mw = { ...em, load: s.loadM };
    this.em = { ...de, exResult: s.exResultE, writeData: s.fwdB };
    this.de = s.flushE ? bubble() : { ...s.dec, rv1: s.rd1D, rv2: s.rd2D };
    if (s.flushD) this.fd = { valid: false, seq: 0, pc: 0, word: 0 };
    else if (!s.stallD) this.fd = { valid: true, seq: ++this.fetchSeq, pc: this.pcF, word: fetchWord(this.text, this.pcF) };
    if (!s.stallF) this.pcF = s.pcSrc ? s.target : (this.pcF + 4) | 0;
  }

  // Advance one cycle. Returns false once the core has halted.
  step() {
    if (this.halted) return false;
    this.edge();
    if (this.halted) { this.sig = null; return false; }
    this.sig = this.comb();
    if (this.mw.valid && this.mw.halt !== HALT_ILLEGAL) this.retired++;
    this.cycle++;
    return true;
  }

  // Same line the testbench prints for the cycle that step() just produced.
  traceLine() {
    const s = this.sig, st = (x) => (x.valid ? hex8(x.pc) : '--------');
    const wb = s.regWriteW && s.rdW !== 0 ? `${s.rdW}:${hex8(s.resultW)}` : '0:00000000';
    const mw = this.em.memWrite ? `${hex8(s.exResultM)}:${hex8(s.wd)}:${s.be.toString(16)}` : '-';
    return `${this.cycle - 1} F=${hex8(this.pcF)} D=${st(this.fd)} E=${st(this.de)} M=${st(this.em)} W=${st(this.mw)}` +
      ` st=${+s.stallF}${+s.stallD} fl=${+s.flushD}${+s.flushE} fw=${s.forwardA}${s.forwardB} wb=${wb} mw=${mw}`;
  }

  run(maxCycles = 100000, onCycle = null) {
    while (this.cycle < maxCycles && this.step()) if (onCycle) onCycle(this);
    return this;
  }
}
