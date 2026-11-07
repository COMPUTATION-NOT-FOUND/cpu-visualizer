// RV32I instruction tables, decoder and disassembler.
// Shared by the assembler, the reference ISS and the pipeline model.

export const OP = {
  LOAD: 0x03, MISC_MEM: 0x0f, OP_IMM: 0x13, AUIPC: 0x17, STORE: 0x23,
  OP: 0x33, LUI: 0x37, BRANCH: 0x63, JALR: 0x67, JAL: 0x6f, SYSTEM: 0x73,
};

export const REG_NAMES = [
  'zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2', 's0', 's1',
  'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7',
  's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11',
  't3', 't4', 't5', 't6',
];

const regIndex = new Map();
REG_NAMES.forEach((n, i) => { regIndex.set(n, i); regIndex.set('x' + i, i); });
regIndex.set('fp', 8);

export function parseReg(s) {
  const i = regIndex.get(String(s).trim().toLowerCase());
  return i === undefined ? -1 : i;
}

// name -> [format, opcode, funct3, funct7]
export const INSTR = {
  lui: ['U', OP.LUI], auipc: ['U', OP.AUIPC],
  jal: ['J', OP.JAL], jalr: ['I', OP.JALR, 0],
  beq: ['B', OP.BRANCH, 0], bne: ['B', OP.BRANCH, 1], blt: ['B', OP.BRANCH, 4],
  bge: ['B', OP.BRANCH, 5], bltu: ['B', OP.BRANCH, 6], bgeu: ['B', OP.BRANCH, 7],
  lb: ['L', OP.LOAD, 0], lh: ['L', OP.LOAD, 1], lw: ['L', OP.LOAD, 2],
  lbu: ['L', OP.LOAD, 4], lhu: ['L', OP.LOAD, 5],
  sb: ['S', OP.STORE, 0], sh: ['S', OP.STORE, 1], sw: ['S', OP.STORE, 2],
  addi: ['I', OP.OP_IMM, 0], slti: ['I', OP.OP_IMM, 2], sltiu: ['I', OP.OP_IMM, 3],
  xori: ['I', OP.OP_IMM, 4], ori: ['I', OP.OP_IMM, 6], andi: ['I', OP.OP_IMM, 7],
  slli: ['SH', OP.OP_IMM, 1, 0x00], srli: ['SH', OP.OP_IMM, 5, 0x00], srai: ['SH', OP.OP_IMM, 5, 0x20],
  add: ['R', OP.OP, 0, 0x00], sub: ['R', OP.OP, 0, 0x20], sll: ['R', OP.OP, 1, 0x00],
  slt: ['R', OP.OP, 2, 0x00], sltu: ['R', OP.OP, 3, 0x00], xor: ['R', OP.OP, 4, 0x00],
  srl: ['R', OP.OP, 5, 0x00], sra: ['R', OP.OP, 5, 0x20], or: ['R', OP.OP, 6, 0x00],
  and: ['R', OP.OP, 7, 0x00],
  fence: ['SYS', OP.MISC_MEM], ecall: ['SYS', OP.SYSTEM], ebreak: ['SYS', OP.SYSTEM],
};

export const sext = (v, bits) => (v << (32 - bits)) >> (32 - bits);

export function immI(w) { return w >> 20; }
export function immS(w) { return ((w >> 25) << 5) | ((w >>> 7) & 0x1f); }
export function immB(w) {
  return sext(((w >>> 31) << 12) | (((w >>> 7) & 1) << 11) | (((w >>> 25) & 0x3f) << 5) | (((w >>> 8) & 0xf) << 1), 13);
}
export function immU(w) { return w & 0xfffff000; }
export function immJ(w) {
  return sext(((w >>> 31) << 20) | (((w >>> 12) & 0xff) << 12) | (((w >>> 20) & 1) << 11) | (((w >>> 21) & 0x3ff) << 1), 21);
}

const BR = ['beq', 'bne', null, null, 'blt', 'bge', 'bltu', 'bgeu'];
const LD = ['lb', 'lh', 'lw', null, 'lbu', 'lhu', null, null];
const ST = ['sb', 'sh', 'sw', null, null, null, null, null];
const OPI = ['addi', 'slli', 'slti', 'sltiu', 'xori', 'srli', 'ori', 'andi'];
const OPR = ['add', 'sll', 'slt', 'sltu', 'xor', 'srl', 'or', 'and'];

// Decode a 32-bit word. Returns null for anything this core does not implement.
export function decode(word) {
  const w = word | 0;
  const op = w & 0x7f, rd = (w >>> 7) & 31, f3 = (w >>> 12) & 7;
  const rs1 = (w >>> 15) & 31, rs2 = (w >>> 20) & 31, f7 = (w >>> 25) & 0x7f;
  const d = { word: w >>> 0, op, rd, rs1, rs2, f3, f7, imm: 0, name: null, fmt: null };
  switch (op) {
    case OP.LUI: return { ...d, name: 'lui', fmt: 'U', imm: immU(w), rs1: 0, rs2: 0 };
    case OP.AUIPC: return { ...d, name: 'auipc', fmt: 'U', imm: immU(w), rs1: 0, rs2: 0 };
    case OP.JAL: return { ...d, name: 'jal', fmt: 'J', imm: immJ(w), rs1: 0, rs2: 0 };
    case OP.JALR: return f3 === 0 ? { ...d, name: 'jalr', fmt: 'I', imm: immI(w), rs2: 0 } : null;
    case OP.BRANCH: return BR[f3] ? { ...d, name: BR[f3], fmt: 'B', imm: immB(w), rd: 0 } : null;
    case OP.LOAD: return LD[f3] ? { ...d, name: LD[f3], fmt: 'L', imm: immI(w), rs2: 0 } : null;
    case OP.STORE: return ST[f3] ? { ...d, name: ST[f3], fmt: 'S', imm: immS(w), rd: 0 } : null;
    case OP.OP_IMM: {
      if (f3 === 1 && f7 !== 0) return null;
      if (f3 === 5 && f7 !== 0 && f7 !== 0x20) return null;
      const name = f3 === 5 && f7 === 0x20 ? 'srai' : OPI[f3];
      const sh = f3 === 1 || f3 === 5;
      return { ...d, name, fmt: sh ? 'SH' : 'I', imm: sh ? rs2 : immI(w), rs2: 0 };
    }
    case OP.OP: {
      if (f7 === 0) return { ...d, name: OPR[f3], fmt: 'R' };
      if (f7 === 0x20 && f3 === 0) return { ...d, name: 'sub', fmt: 'R' };
      if (f7 === 0x20 && f3 === 5) return { ...d, name: 'sra', fmt: 'R' };
      return null;
    }
    case OP.MISC_MEM: return f3 === 0 ? { ...d, name: 'fence', fmt: 'SYS', rd: 0, rs1: 0, rs2: 0 } : null;
    case OP.SYSTEM:
      if ((w >>> 0) === 0x00000073) return { ...d, name: 'ecall', fmt: 'SYS', rs2: 0 };
      if ((w >>> 0) === 0x00100073) return { ...d, name: 'ebreak', fmt: 'SYS', rs2: 0 };
      return null;
    default: return null;
  }
}

const hex = (v) => '0x' + (v >>> 0).toString(16);
const r = (i) => REG_NAMES[i];

// Human-readable form. `pc` turns branch/jump offsets into absolute targets.
export function disasm(word, pc = null) {
  const d = decode(word);
  if (!d) return `.word ${hex(word)}`;
  const tgt = (off) => (pc === null ? String(off) : hex(pc + off));
  switch (d.fmt) {
    case 'U': return `${d.name} ${r(d.rd)}, ${hex(d.imm >>> 12)}`;
    case 'J': return `jal ${r(d.rd)}, ${tgt(d.imm)}`;
    case 'B': return `${d.name} ${r(d.rs1)}, ${r(d.rs2)}, ${tgt(d.imm)}`;
    case 'L': return `${d.name} ${r(d.rd)}, ${d.imm}(${r(d.rs1)})`;
    case 'S': return `${d.name} ${r(d.rs2)}, ${d.imm}(${r(d.rs1)})`;
    case 'R': return `${d.name} ${r(d.rd)}, ${r(d.rs1)}, ${r(d.rs2)}`;
    case 'SH': return `${d.name} ${r(d.rd)}, ${r(d.rs1)}, ${d.imm}`;
    case 'I':
      if (d.name === 'jalr') return `jalr ${r(d.rd)}, ${d.imm}(${r(d.rs1)})`;
      if (d.name === 'addi' && d.rd === 0 && d.rs1 === 0 && d.imm === 0) return 'nop';
      return `${d.name} ${r(d.rd)}, ${r(d.rs1)}, ${d.imm}`;
    default: return d.name;
  }
}

// Encoders (values are masked; range checks live in the assembler).
export const enc = {
  R: (op, f3, f7, rd, rs1, rs2) => ((f7 << 25) | (rs2 << 20) | (rs1 << 15) | (f3 << 12) | (rd << 7) | op) >>> 0,
  I: (op, f3, rd, rs1, imm) => (((imm & 0xfff) << 20) | (rs1 << 15) | (f3 << 12) | (rd << 7) | op) >>> 0,
  S: (op, f3, rs1, rs2, imm) =>
    ((((imm >> 5) & 0x7f) << 25) | (rs2 << 20) | (rs1 << 15) | (f3 << 12) | ((imm & 0x1f) << 7) | op) >>> 0,
  B: (op, f3, rs1, rs2, imm) =>
    ((((imm >> 12) & 1) << 31) | (((imm >> 5) & 0x3f) << 25) | (rs2 << 20) | (rs1 << 15) | (f3 << 12) |
      (((imm >> 1) & 0xf) << 8) | (((imm >> 11) & 1) << 7) | op) >>> 0,
  U: (op, rd, imm) => ((imm & 0xfffff000) | (rd << 7) | op) >>> 0,
  J: (op, rd, imm) =>
    ((((imm >> 20) & 1) << 31) | (((imm >> 1) & 0x3ff) << 21) | (((imm >> 11) & 1) << 20) |
      (((imm >> 12) & 0xff) << 12) | (rd << 7) | op) >>> 0,
};
