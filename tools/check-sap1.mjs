// Checks the SAP-1 for every program in programs/sap1:
//   1. Icarus RTL trace == JS T-state model trace, step by step
//   2. final A/B/OUT/PC and the list of OUT values == instruction-level reference
//   3. "# expect a=56 out=56 outputs=16,56" comments
// usage: node tools/check-sap1.mjs [program.s ...] [--iverilog <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { assemble } from '../web/js/sap1/asm.js';
import { SAP1, reference } from '../web/js/sap1/sim.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const args = process.argv.slice(2);
const ivIdx = args.indexOf('--iverilog');
const ivDir = ivIdx >= 0 ? args.splice(ivIdx, 2)[1] : process.env.IVERILOG_DIR || 'C:/iverilog/bin';
const exe = (n) => path.join(ivDir, process.platform === 'win32' ? `${n}.exe` : n);
const MAX = 600;

const build = path.join(root, 'build');
fs.mkdirSync(build, { recursive: true });
const vvp = path.join(build, 'sap1.vvp');
execFileSync(exe('iverilog'), ['-g2012', '-o', vvp,
  ...['sap1_ctrl', 'sap1_core'].map((f) => path.join(root, 'rtl/sap1', `${f}.sv`)),
  path.join(root, 'sim/tb_sap1.sv')], { stdio: ['ignore', 'ignore', 'pipe'] });

const dir = path.join(root, 'programs/sap1');
const list = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? list(path.join(d, e.name)) : e.name.endsWith('.s') ? [path.join(d, e.name)] : []);
const programs = args.length ? args.map((a) => path.resolve(a)) : list(dir);
const h2 = (v) => v.toString(16).padStart(2, '0');

let failed = 0;
for (const file of programs) {
  const name = path.relative(root, file).replace(/\\/g, '/');
  const src = fs.readFileSync(file, 'utf8');
  const prog = assemble(src);
  if (prog.errors.length) {
    failed++;
    console.log(`FAIL ${name}: ${prog.errors.map((e) => `line ${e.line}: ${e.message}`).join('; ')}`);
    continue;
  }
  const hexFile = path.join(build, 'sap1.hex');
  fs.writeFileSync(hexFile, Array.from(prog.mem, h2).join('\n') + '\n');
  const out = execFileSync(exe('vvp'), ['-n', vvp, `+prog=${hexFile}`, `+max=${MAX}`], { encoding: 'utf8' })
    .split(/\r?\n/).filter((l) => l && !l.includes('$finish'));
  const rtlTrace = out.filter((l) => /^\d+ T\d/.test(l));
  const summary = out.find((l) => l.startsWith('halt='));
  const rtlRegs = out.find((l) => l.startsWith('a='));

  const problems = [];
  const sim = new SAP1(prog.mem);
  const jsTrace = [];
  sim.run(MAX, (s) => jsTrace.push(s.traceLine()));
  for (let i = 0; i < Math.max(rtlTrace.length, jsTrace.length); i++) {
    if (rtlTrace[i] !== jsTrace[i]) {
      problems.push(`trace differs at step ${i}\n    rtl: ${rtlTrace[i] ?? '(end)'}\n    js:  ${jsTrace[i] ?? '(end)'}`);
      break;
    }
  }
  const jsSummary = `halt=${sim.halted ? 'hlt' : 'timeout'} tstates=${sim.steps} instrs=${sim.instrs}`;
  const jsRegs = `a=${h2(sim.a)} b=${h2(sim.b)} out=${h2(sim.out)} pc=${sim.pc.toString(16)}`;
  if (summary !== jsSummary) problems.push(`summary: rtl "${summary}" js "${jsSummary}"`);
  if (rtlRegs !== jsRegs) problems.push(`registers: rtl "${rtlRegs}" js "${jsRegs}"`);

  const ref = reference(prog.mem);
  if (sim.halted) {
    const refRegs = `a=${h2(ref.a)} b=${h2(ref.b)} out=${h2(ref.out)} pc=${ref.pc.toString(16)}`;
    if (!ref.halted || refRegs !== jsRegs) problems.push(`reference: "${refRegs}" model "${jsRegs}"`);
    if (ref.instrs !== sim.instrs) problems.push(`instructions: reference ${ref.instrs} model ${sim.instrs}`);
    if (ref.outputs.join() !== sim.outputs.join()) problems.push(`outputs: reference [${ref.outputs}] model [${sim.outputs}]`);
  }

  for (const line of src.matchAll(/^\s*[;#]\s*expect\s+(.*)$/gm)) {
    for (const item of line[1].trim().split(/\s+/)) {
      const [k, v] = item.split('=');
      if (k === 'outputs') {
        const want = v.split(',').map((x) => Number(x) & 0xff).join();
        if (sim.outputs.join() !== want) problems.push(`expect ${item}: got ${sim.outputs.join()}`);
      } else if (k === 'halt') {
        if ((sim.halted ? 'hlt' : 'timeout') !== v) problems.push(`expect ${item}`);
      } else if (['a', 'b', 'out', 'pc'].includes(k)) {
        if (sim[k] !== (Number(v) & 0xff)) problems.push(`expect ${item}: got ${sim[k]}`);
      } else problems.push(`bad expect "${item}"`);
    }
  }

  if (problems.length) { failed++; console.log(`FAIL ${name}\n  ${problems.join('\n  ')}`); }
  else console.log(`ok   ${name}  (${sim.steps} T-states, ${sim.instrs} instructions, outputs [${sim.outputs}])`);
}
console.log(failed ? `\n${failed} of ${programs.length} failed` : `\nall ${programs.length} passed`);
process.exit(failed ? 1 : 0);
