// SAP-1 assembler. 16 bytes of memory hold both the program and its data.
//
//   loop:  LDA x        ; labels end with ':'; comments start with ';' or '#'
//          ADD 0xA      ; operands: label, decimal, 0x.. hex, ..h hex, 0b.. binary
//          OUT
//          HLT
//   x:     .byte 5      ; also DB / .db; several values allowed: .byte 1, 2, 3
//          .org 12      ; also ORG: continue at this address
export const OPCODES = { LDA: 0x0, ADD: 0x1, SUB: 0x2, OUT: 0xe, HLT: 0xf };
export const NEEDS_ADDR = new Set(['LDA', 'ADD', 'SUB']);
export const MEM_SIZE = 16;

export function disasm(byte) {
  const op = byte >> 4, addr = byte & 0xf;
  const name = Object.keys(OPCODES).find((k) => OPCODES[k] === op);
  if (!name) return 'NOP';
  return NEEDS_ADDR.has(name) ? `${name} ${addr}` : name;
}

function parseNumber(s) {
  const t = s.trim().toLowerCase();
  let m;
  if ((m = /^-?(\d+)$/.exec(t))) return Number(t);
  if ((m = /^0x([0-9a-f]+)$/.exec(t))) return parseInt(m[1], 16);
  if ((m = /^([0-9a-f]+)h$/.exec(t))) return parseInt(m[1], 16);
  if ((m = /^0b([01]+)$/.exec(t))) return parseInt(m[1], 2);
  return null;
}

export function assemble(source) {
  const mem = new Uint8Array(MEM_SIZE);
  const lineOf = new Array(MEM_SIZE).fill(-1);   // address -> source line (1-based)
  const symbols = new Map();
  const errors = [];
  const items = [];

  // Pass 1: labels and addresses.
  let addr = 0;
  source.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    let text = raw.replace(/[;#].*$/, '').trim();
    const lab = /^([A-Za-z_]\w*)\s*:\s*(.*)$/.exec(text);
    if (lab) {
      const name = lab[1].toLowerCase();
      if (symbols.has(name)) errors.push({ line, message: `label "${lab[1]}" defined twice` });
      symbols.set(name, addr);
      text = lab[2].trim();
    }
    if (!text) return;
    const [head, ...rest] = text.split(/\s+/);
    const mnem = head.toUpperCase();
    const args = rest.join(' ');
    if (mnem === '.ORG' || mnem === 'ORG') {
      const n = parseNumber(args);
      if (n == null || n < 0 || n >= MEM_SIZE) errors.push({ line, message: `bad address "${args}"` });
      else addr = n;
      return;
    }
    if (mnem === '.BYTE' || mnem === 'DB' || mnem === '.DB') {
      const vals = args.split(',').map((s) => s.trim()).filter(Boolean);
      if (!vals.length) errors.push({ line, message: 'missing value' });
      for (const v of vals) items.push({ line, addr: addr++, kind: 'byte', arg: v });
      return;
    }
    if (!(mnem in OPCODES)) { errors.push({ line, message: `unknown instruction "${head}"` }); return; }
    if (NEEDS_ADDR.has(mnem) && !args) errors.push({ line, message: `${mnem} needs an address` });
    if (!NEEDS_ADDR.has(mnem) && args) errors.push({ line, message: `${mnem} takes no operand` });
    items.push({ line, addr: addr++, kind: 'op', mnem, arg: args });
  });

  const value = (s, line) => {
    const n = parseNumber(s);
    if (n != null) return n;
    const v = symbols.get(s.trim().toLowerCase());
    if (v === undefined) errors.push({ line, message: `unknown label "${s.trim()}"` });
    return v ?? 0;
  };

  // Pass 2: encode.
  for (const it of items) {
    if (it.addr >= MEM_SIZE) { errors.push({ line: it.line, message: 'program does not fit in 16 bytes' }); continue; }
    if (lineOf[it.addr] !== -1) errors.push({ line: it.line, message: `address ${it.addr} already used (line ${lineOf[it.addr]})` });
    lineOf[it.addr] = it.line;
    if (it.kind === 'byte') {
      const v = value(it.arg, it.line);
      if (v < -128 || v > 255) errors.push({ line: it.line, message: `value ${v} does not fit in a byte` });
      mem[it.addr] = v & 0xff;
    } else {
      let a = 0;
      if (NEEDS_ADDR.has(it.mnem) && it.arg) {
        a = value(it.arg, it.line);
        if (a < 0 || a >= MEM_SIZE) errors.push({ line: it.line, message: `address ${a} is outside 0..15` });
      }
      mem[it.addr] = (OPCODES[it.mnem] << 4) | (a & 0xf);
    }
  }
  return { mem, lineOf, symbols, errors };
}
