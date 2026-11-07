// Assemble a program and run it on the reference ISS.
// usage: node tools/run-iss.mjs program.s [--hex out.hex] [--dhex data.hex] [--list]
import fs from 'node:fs';
import { assemble } from '../web/js/rv32i/asm.js';
import { ISS } from '../web/js/rv32i/iss.js';
import { disasm, REG_NAMES } from '../web/js/rv32i/isa.js';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const p = assemble(fs.readFileSync(args[0], 'utf8'));
if (p.errors.length) { for (const e of p.errors) console.error(`${args[0]}:${e.line}: ${e.message}`); process.exit(1); }
if (args.includes('--list')) p.text.forEach((w, i) => console.log((i * 4).toString(16).padStart(4, '0'), w.toString(16).padStart(8, '0'), disasm(w, i * 4)));
if (opt('--hex')) fs.writeFileSync(opt('--hex'), Array.from(p.text, (w) => w.toString(16).padStart(8, '0')).join('\n') + '\n');
if (opt('--dhex')) {
  const words = [];
  for (let i = 0; i < p.data.length; i += 4) words.push(((p.data[i] | (p.data[i + 1] << 8) | (p.data[i + 2] << 16) | (p.data[i + 3] << 24)) >>> 0).toString(16).padStart(8, '0'));
  fs.writeFileSync(opt('--dhex'), words.join('\n') + '\n');
}
const s = new ISS(p).run();
console.log(`halted=${s.halted} retired=${s.retired}`);
for (let i = 1; i < 32; i++) if (s.regs[i]) console.log(`${REG_NAMES[i].padEnd(4)} ${(s.regs[i] >>> 0).toString(16).padStart(8, '0')} ${s.regs[i]}`);
