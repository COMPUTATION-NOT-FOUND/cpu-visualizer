// Pad a program to N words with nops (for the archived RTL, which has no halt).
import fs from 'node:fs';
import { assemble } from '../web/js/rv32i/asm.js';
const [src, out, n = '64'] = process.argv.slice(2);
const p = assemble(fs.readFileSync(src, 'utf8'));
if (p.errors.length) { console.error(p.errors); process.exit(1); }
const w = Array.from(p.text, (x) => x.toString(16).padStart(8, '0'));
while (w.length < +n) w.push('00000013');
fs.writeFileSync(out, w.join('\n') + '\n');
