// Two-pass RV32I assembler with the common pseudo-instructions.
//
// Memory model (Harvard, like the Harris & Harris pipeline):
//   instruction memory: 4 KiB at 0x0000 (.text)
//   data memory:        4 KiB at 0x0000 of its own address space (.data)
// Programs stop with `ecall` or `ebreak`.

import { INSTR, OP, enc, parseReg } from './isa.js';

export const IMEM_BYTES = 4096;
export const DMEM_BYTES = 4096;

class AsmError extends Error {
  constructor(msg) { super(msg); this.name = 'AsmError'; }
}

const fits = (v, bits) => v >= -(2 ** (bits - 1)) && v < 2 ** (bits - 1);
const fitsU = (v, bits) => v >= 0 && v < 2 ** bits;

// --- tokenising -------------------------------------------------------------

function stripComment(line) {
  let out = '', q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      out += c;
      if (c === '\\') { out += line[++i] ?? ''; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'") { q = c; out += c; continue; }
    if (c === '#' || c === ';') break;
    if (c === '/' && line[i + 1] === '/') break;
    out += c;
  }
  return out;
}

function splitOperands(s) {
  const out = [];
  let cur = '', depth = 0, q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { cur += c; if (c === '\\') cur += s[++i] ?? ''; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim() !== '') out.push(cur.trim());
  return out;
}

function unescape(body) {
  const out = [];
  for (let i = 0; i < body.length; i++) {
    let c = body[i];
    if (c === '\\') {
      const n = body[++i];
      c = { n: '\n', t: '\t', r: '\r', 0: '\0', '\\': '\\', '"': '"', "'": "'" }[n];
      if (c === undefined) throw new AsmError(`unknown escape \\${n}`);
    }
    out.push(c.charCodeAt(0) & 0xff);
  }
  return out;
}

// --- expressions --------------------------------------------------------------
// expr := term (('+'|'-') term)*
// term := number | 'c' | symbol | %hi(expr) | %lo(expr) | '-' term | '(' expr ')'

function evalExpr(src, symbols, needSymbols) {
  const s = src.replace(/\s+/g, '');
  let i = 0;
  let usedSymbol = false;
  const peek = () => s[i];
  function term() {
    if (s[i] === '-') { i++; return -term(); }
    if (s[i] === '+') { i++; return term(); }
    if (s[i] === '(') { i++; const v = expr(); if (s[i++] !== ')') throw new AsmError(`missing ')' in "${src}"`); return v; }
    if (s.startsWith('%hi(', i) || s.startsWith('%lo(', i)) {
      const hi = s[i + 1] === 'h';
      i += 4;
      const v = expr();
      if (s[i++] !== ')') throw new AsmError(`missing ')' in "${src}"`);
      const lo = sext12(v);
      return hi ? ((v - lo) >>> 12) & 0xfffff : lo;
    }
    if (s[i] === "'") {
      const end = s.indexOf("'", i + 1 + (s[i + 1] === '\\' ? 1 : 0));
      if (end < 0) throw new AsmError(`bad character literal in "${src}"`);
      const bytes = unescape(s.slice(i + 1, end));
      if (bytes.length !== 1) throw new AsmError(`bad character literal in "${src}"`);
      i = end + 1;
      return bytes[0];
    }
    const m = /^(0x[0-9a-f_]+|0b[01_]+|[0-9][0-9_]*)/i.exec(s.slice(i));
    if (m) {
      i += m[0].length;
      const t = m[0].replace(/_/g, '').toLowerCase();
      if (t.startsWith('0b')) return parseInt(t.slice(2), 2);
      return Number(t);
    }
    const id = /^[A-Za-z_.$][\w.$]*/.exec(s.slice(i));
    if (id) {
      i += id[0].length;
      usedSymbol = true;
      if (!symbols) return 0;
      if (!symbols.has(id[0])) {
        if (needSymbols) throw new AsmError(`unknown symbol "${id[0]}"`);
        return 0;
      }
      return symbols.get(id[0]);
    }
    throw new AsmError(`cannot read "${src}"`);
  }
  function expr() {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = s[i++];
      const t = term();
      v = op === '+' ? v + t : v - t;
    }
    return v;
  }
  if (s === '') throw new AsmError('missing operand');
  const v = expr();
  if (i !== s.length) throw new AsmError(`cannot read "${src}"`);
  return { value: v, usedSymbol };
}

const sext12 = (v) => ((v & 0xfff) << 20) >> 20;

// --- the assembler ------------------------------------------------------------------

const PSEUDO_SIZE = { la: 2, call: 1, tail: 1 };

export function assemble(source) {
  const errors = [];
  const symbols = new Map();
  const items = []; // { kind, line, sect, addr, size, ... }
  const pc = { text: 0, data: 0 };
  let sect = 'text';
  const lines = source.split(/\r?\n/);

  const fail = (line, e) => errors.push({ line, message: e instanceof AsmError ? e.message : String(e) });

  // Pass 1: labels, sizes, addresses.
  lines.forEach((raw, idx) => {
    const line = idx + 1;
    let s = stripComment(raw).trim();
    try {
      for (;;) {
        const m = /^([A-Za-z_.$][\w.$]*)\s*:/.exec(s);
        if (!m) break;
        if (symbols.has(m[1])) throw new AsmError(`label "${m[1]}" defined twice`);
        symbols.set(m[1], pc[sect]);
        s = s.slice(m[0].length).trim();
      }
      if (s === '') return;
      const sp = s.search(/\s/);
      const mnem = (sp < 0 ? s : s.slice(0, sp)).toLowerCase();
      const rest = sp < 0 ? '' : s.slice(sp + 1).trim();
      const ops = splitOperands(rest);

      if (mnem.startsWith('.')) {
        const it = { kind: 'dir', mnem, ops, line, sect, addr: pc[sect], size: 0 };
        switch (mnem) {
          case '.text': sect = 'text'; return;
          case '.data': case '.rodata': case '.bss': sect = 'data'; return;
          case '.section':
            sect = /text/.test(ops[0] || '') ? 'text' : 'data';
            return;
          case '.globl': case '.global': case '.type': case '.size': case '.file': return;
          case '.equ': case '.set': {
            if (ops.length !== 2) throw new AsmError(`${mnem} needs a name and a value`);
            symbols.set(ops[0], evalExpr(ops[1], symbols, true).value);
            return;
          }
          case '.word': it.size = 4 * ops.length; break;
          case '.half': case '.short': it.size = 2 * ops.length; break;
          case '.byte': it.size = ops.length; break;
          case '.space': case '.zero': case '.skip':
            it.size = evalExpr(ops[0] ?? '', symbols, true).value;
            if (it.size < 0) throw new AsmError('negative size');
            break;
          case '.align': case '.p2align': case '.balign': {
            const n = evalExpr(ops[0] ?? '', symbols, true).value;
            const a = mnem === '.balign' ? n : 2 ** n;
            it.size = (a - (pc[sect] % a)) % a;
            break;
          }
          case '.ascii': case '.asciz': case '.string': {
            it.bytes = [];
            for (const o of ops) {
              if (!/^".*"$/.test(o)) throw new AsmError(`${mnem} needs a "string"`);
              it.bytes.push(...unescape(o.slice(1, -1)));
              if (mnem !== '.ascii') it.bytes.push(0);
            }
            it.size = it.bytes.length;
            break;
          }
          default: throw new AsmError(`unknown directive ${mnem}`);
        }
        if (sect === 'text' && !['.word', '.align', '.p2align', '.balign', '.space', '.zero', '.skip'].includes(mnem)) {
          throw new AsmError(`${mnem} is only allowed in .data`);
        }
        if (sect === 'text' && it.size % 4) throw new AsmError('.text must stay word-aligned');
        items.push(it);
        pc[sect] += it.size;
        return;
      }

      if (sect !== 'text') throw new AsmError('instructions must be in .text');
      let size = 1;
      if (mnem === 'li') {
        try {
          const { value, usedSymbol } = evalExpr(ops[1] ?? '', null, false);
          size = !usedSymbol && fits(value, 12) ? 1 : 2;
        } catch { size = 2; }
      } else if (PSEUDO_SIZE[mnem]) size = PSEUDO_SIZE[mnem];
      items.push({ kind: 'ins', mnem, ops, line, sect, addr: pc.text, size: size * 4 });
      pc.text += size * 4;
    } catch (e) { fail(line, e); }
  });

  if (pc.text > IMEM_BYTES) errors.push({ line: 0, message: `program is ${pc.text} bytes; instruction memory holds ${IMEM_BYTES}` });
  if (pc.data > DMEM_BYTES) errors.push({ line: 0, message: `data is ${pc.data} bytes; data memory holds ${DMEM_BYTES}` });

  // Pass 2: encode.
  const text = new Uint32Array(pc.text / 4);
  const data = new Uint8Array(Math.max(pc.data, 0));
  const lineOf = new Int32Array(pc.text / 4); // source line for each instruction word
  for (const it of items) {
    try {
      if (it.kind === 'dir') emitDirective(it, symbols, text, data);
      else {
        const words = encodeIns(it, symbols);
        if (words.length * 4 !== it.size) throw new AsmError('internal: size changed between passes');
        words.forEach((w, k) => { text[it.addr / 4 + k] = w; lineOf[it.addr / 4 + k] = it.line; });
      }
    } catch (e) { fail(it.line, e); }
  }
  errors.sort((a, b) => a.line - b.line);
  return { text, data, symbols, lineOf, errors };
}

function emitDirective(it, symbols, text, data) {
  const val = (o) => evalExpr(o, symbols, true).value;
  const put = (addr, v, n) => {
    if (it.sect === 'text') { text[addr / 4] = v >>> 0; return; }
    for (let k = 0; k < n; k++) data[addr + k] = (v >>> (8 * k)) & 0xff;
  };
  let a = it.addr;
  switch (it.mnem) {
    case '.word': for (const o of it.ops) { put(a, val(o), 4); a += 4; } break;
    case '.half': case '.short':
      for (const o of it.ops) {
        const v = val(o);
        if (!fits(v, 16) && !fitsU(v, 16)) throw new AsmError(`${v} does not fit in 16 bits`);
        put(a, v, 2); a += 2;
      }
      break;
    case '.byte':
      for (const o of it.ops) {
        const v = val(o);
        if (!fits(v, 8) && !fitsU(v, 8)) throw new AsmError(`${v} does not fit in 8 bits`);
        put(a, v, 1); a += 1;
      }
      break;
    case '.ascii': case '.asciz': case '.string': it.bytes.forEach((b, k) => { data[a + k] = b; }); break;
    default: break; // .space/.align: memory is already zero
  }
}

function encodeIns(it, symbols) {
  const { mnem, ops, addr } = it;
  const want = (n) => { if (ops.length !== n) throw new AsmError(`${mnem} takes ${n} operand${n === 1 ? '' : 's'}`); };
  const reg = (s) => {
    const r = parseReg(s ?? '');
    if (r < 0) throw new AsmError(`"${s}" is not a register`);
    return r;
  };
  const imm = (s) => evalExpr(s, symbols, true).value;
  const imm12 = (s) => {
    const v = imm(s);
    if (!fits(v, 12)) throw new AsmError(`immediate ${v} does not fit in 12 bits (-2048..2047)`);
    return v;
  };
  const rel = (s, bits) => {
    const off = imm(s) - addr;
    if (off & 1) throw new AsmError('branch target must be 2-byte aligned');
    if (!fits(off, bits)) throw new AsmError(`target is too far away (${off} bytes)`);
    return off;
  };
  const mem = (s) => {
    const m = /^(.*)\(\s*([^)]+)\s*\)$/.exec(s ?? '');
    if (!m) throw new AsmError(`expected offset(register), got "${s}"`);
    return { off: m[1].trim() === '' ? 0 : imm12(m[1]), base: reg(m[2]) };
  };
  const I = (name, rd, rs1, v) => { const [, op, f3] = INSTR[name]; return enc.I(op, f3, rd, rs1, v); };
  const R = (name, rd, rs1, rs2) => { const [, op, f3, f7] = INSTR[name]; return enc.R(op, f3, f7, rd, rs1, rs2); };
  const B = (name, rs1, rs2, target) => { const [, op, f3] = INSTR[name]; return enc.B(op, f3, rs1, rs2, rel(target, 13)); };
  const JAL = (rd, target) => enc.J(OP.JAL, rd, rel(target, 21));
  const hiLo = (v) => { const lo = sext12(v); return [((v - lo) >>> 0) & 0xfffff000, lo]; };

  // Pseudo-instructions.
  switch (mnem) {
    case 'nop': want(0); return [I('addi', 0, 0, 0)];
    case 'li': {
      want(2);
      const rd = reg(ops[0]), v = imm(ops[1]);
      if (!fits(v, 32) && !fitsU(v, 32)) throw new AsmError(`${v} does not fit in 32 bits`);
      if (it.size === 4) return [I('addi', rd, 0, v)];
      const [hi, lo] = hiLo(v | 0);
      return [enc.U(OP.LUI, rd, hi), I('addi', rd, rd, lo)];
    }
    case 'la': {
      want(2);
      const rd = reg(ops[0]);
      const [hi, lo] = hiLo(imm(ops[1]) | 0);
      return [enc.U(OP.LUI, rd, hi), I('addi', rd, rd, lo)];
    }
    case 'mv': want(2); return [I('addi', reg(ops[0]), reg(ops[1]), 0)];
    case 'not': want(2); return [I('xori', reg(ops[0]), reg(ops[1]), -1)];
    case 'neg': want(2); return [R('sub', reg(ops[0]), 0, reg(ops[1]))];
    case 'seqz': want(2); return [I('sltiu', reg(ops[0]), reg(ops[1]), 1)];
    case 'snez': want(2); return [R('sltu', reg(ops[0]), 0, reg(ops[1]))];
    case 'sltz': want(2); return [R('slt', reg(ops[0]), reg(ops[1]), 0)];
    case 'sgtz': want(2); return [R('slt', reg(ops[0]), 0, reg(ops[1]))];
    case 'beqz': want(2); return [B('beq', reg(ops[0]), 0, ops[1])];
    case 'bnez': want(2); return [B('bne', reg(ops[0]), 0, ops[1])];
    case 'blez': want(2); return [B('bge', 0, reg(ops[0]), ops[1])];
    case 'bgez': want(2); return [B('bge', reg(ops[0]), 0, ops[1])];
    case 'bltz': want(2); return [B('blt', reg(ops[0]), 0, ops[1])];
    case 'bgtz': want(2); return [B('blt', 0, reg(ops[0]), ops[1])];
    case 'bgt': want(3); return [B('blt', reg(ops[1]), reg(ops[0]), ops[2])];
    case 'ble': want(3); return [B('bge', reg(ops[1]), reg(ops[0]), ops[2])];
    case 'bgtu': want(3); return [B('bltu', reg(ops[1]), reg(ops[0]), ops[2])];
    case 'bleu': want(3); return [B('bgeu', reg(ops[1]), reg(ops[0]), ops[2])];
    case 'j': want(1); return [JAL(0, ops[0])];
    case 'call': want(1); return [JAL(1, ops[0])];
    case 'tail': want(1); return [JAL(0, ops[0])];
    case 'jr': want(1); return [I('jalr', 0, reg(ops[0]), 0)];
    case 'ret': want(0); return [I('jalr', 0, 1, 0)];
    default: break;
  }

  const spec = INSTR[mnem];
  if (!spec) throw new AsmError(`unknown instruction "${mnem}"`);
  const [fmt, op, f3, f7] = spec;
  switch (fmt) {
    case 'R': want(3); return [enc.R(op, f3, f7, reg(ops[0]), reg(ops[1]), reg(ops[2]))];
    case 'I':
      if (mnem === 'jalr') {
        if (ops.length === 1) return [enc.I(op, 0, 1, reg(ops[0]), 0)];
        if (ops.length === 2) { const m = mem(ops[1]); return [enc.I(op, 0, reg(ops[0]), m.base, m.off)]; }
        want(3);
        return [enc.I(op, 0, reg(ops[0]), reg(ops[1]), imm12(ops[2]))];
      }
      want(3);
      return [enc.I(op, f3, reg(ops[0]), reg(ops[1]), imm12(ops[2]))];
    case 'SH': {
      want(3);
      const sh = imm(ops[2]);
      if (!fitsU(sh, 5)) throw new AsmError(`shift amount ${sh} must be 0..31`);
      return [enc.R(op, f3, f7, reg(ops[0]), reg(ops[1]), sh)];
    }
    case 'L': { want(2); const m = mem(ops[1]); return [enc.I(op, f3, reg(ops[0]), m.base, m.off)]; }
    case 'S': { want(2); const m = mem(ops[1]); return [enc.S(op, f3, m.base, reg(ops[0]), m.off)]; }
    case 'B': want(3); return [B(mnem, reg(ops[0]), reg(ops[1]), ops[2])];
    case 'U': {
      want(2);
      const v = imm(ops[1]);
      if (!fitsU(v, 20)) throw new AsmError(`upper immediate ${v} must be 0..0xfffff`);
      return [enc.U(op, reg(ops[0]), v << 12)];
    }
    case 'J':
      if (ops.length === 1) return [JAL(1, ops[0])];
      want(2);
      return [JAL(reg(ops[0]), ops[1])];
    case 'SYS':
      want(0);
      if (mnem === 'fence') return [0x0ff0000f];
      return [mnem === 'ecall' ? 0x00000073 : 0x00100073];
    default: throw new AsmError(`unknown instruction "${mnem}"`);
  }
}
