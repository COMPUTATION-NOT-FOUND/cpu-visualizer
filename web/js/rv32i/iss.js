// Reference instruction-set simulator: one instruction per step, no timing.
// The pipeline model and the RTL are checked against this.

import { decode } from './isa.js';
import { IMEM_BYTES, DMEM_BYTES } from './asm.js';

// Data memory with the same addressing as rtl/rv32i/dmem.sv:
// the low 12 bits pick the byte, and accesses are aligned down to their size.
export class DataMemory {
  constructor(init) {
    this.bytes = new Uint8Array(DMEM_BYTES);
    if (init) this.bytes.set(init.subarray(0, DMEM_BYTES));
  }
  load(addr, f3) {
    const size = 1 << (f3 & 3);
    const a = (addr & (DMEM_BYTES - 1)) & ~(size - 1);
    let v = 0;
    for (let k = size - 1; k >= 0; k--) v = (v << 8) | this.bytes[a + k];
    if (f3 === 0) return (v << 24) >> 24;
    if (f3 === 1) return (v << 16) >> 16;
    return v | 0;
  }
  store(addr, f3, value) {
    const size = 1 << (f3 & 3);
    const a = (addr & (DMEM_BYTES - 1)) & ~(size - 1);
    for (let k = 0; k < size; k++) this.bytes[a + k] = (value >>> (8 * k)) & 0xff;
  }
  word(i) { return this.load(i * 4, 2); }
}

export function fetchWord(text, pc) {
  const i = (pc & (IMEM_BYTES - 1)) >>> 2;
  return i < text.length ? text[i] : 0;
}

// Result of one ALU-style operation; shared with the pipeline model.
export function aluOp(name, a, b) {
  switch (name) {
    case 'add': case 'addi': return (a + b) | 0;
    case 'sub': return (a - b) | 0;
    case 'and': case 'andi': return a & b;
    case 'or': case 'ori': return a | b;
    case 'xor': case 'xori': return a ^ b;
    case 'sll': case 'slli': return a << (b & 31);
    case 'srl': case 'srli': return a >>> (b & 31) | 0;
    case 'sra': case 'srai': return a >> (b & 31);
    case 'slt': case 'slti': return (a | 0) < (b | 0) ? 1 : 0;
    case 'sltu': case 'sltiu': return (a >>> 0) < (b >>> 0) ? 1 : 0;
    default: throw new Error(`aluOp: ${name}`);
  }
}

export function branchTaken(name, a, b) {
  switch (name) {
    case 'beq': return a === b;
    case 'bne': return a !== b;
    case 'blt': return (a | 0) < (b | 0);
    case 'bge': return (a | 0) >= (b | 0);
    case 'bltu': return (a >>> 0) < (b >>> 0);
    case 'bgeu': return (a >>> 0) >= (b >>> 0);
    default: throw new Error(`branchTaken: ${name}`);
  }
}

export class ISS {
  constructor(program) {
    this.text = program.text;
    this.mem = new DataMemory(program.data);
    this.regs = new Int32Array(32);
    this.pc = 0;
    this.retired = 0;
    this.halted = null; // null | 'ecall' | 'ebreak' | 'illegal'
    this.log = []; // { pc, word, rd, value, store }
  }

  step() {
    if (this.halted) return false;
    const pc = this.pc;
    const word = fetchWord(this.text, pc);
    const d = decode(word);
    const x = this.regs;
    const rec = { pc, word, rd: 0, value: 0, store: null };
    let next = (pc + 4) | 0;
    let wb = null;
    if (!d) {
      this.halted = 'illegal';
      return false;
    }
    const a = x[d.rs1], b = x[d.rs2];
    switch (d.fmt) {
      case 'U': wb = d.name === 'lui' ? d.imm : (pc + d.imm) | 0; break;
      case 'J': wb = next; next = (pc + d.imm) | 0; break;
      case 'B': if (branchTaken(d.name, a, b)) next = (pc + d.imm) | 0; break;
      case 'L': wb = this.mem.load((a + d.imm) | 0, d.f3); break;
      case 'S': {
        const addr = (a + d.imm) | 0;
        this.mem.store(addr, d.f3, b);
        rec.store = { addr, f3: d.f3, value: b };
        break;
      }
      case 'R': wb = aluOp(d.name, a, b); break;
      case 'I':
        if (d.name === 'jalr') { wb = next; next = ((a + d.imm) & ~1) | 0; } else wb = aluOp(d.name, a, d.imm);
        break;
      case 'SH': wb = aluOp(d.name, a, d.imm); break;
      case 'SYS':
        if (d.name !== 'fence') { this.halted = d.name; this.retired++; this.log.push(rec); return false; }
        break;
      default: break;
    }
    if (wb !== null && d.rd !== 0) { x[d.rd] = wb; rec.rd = d.rd; rec.value = wb; }
    this.pc = next;
    this.retired++;
    this.log.push(rec);
    return true;
  }

  run(maxSteps = 100000) {
    while (this.retired < maxSteps && this.step());
    return this;
  }
}
