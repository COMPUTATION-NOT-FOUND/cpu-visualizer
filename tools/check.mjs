// Checks the RV32I pipeline three ways for every program in programs/rv32i (and subfolders):
//   1. Icarus RTL trace == JS pipeline model trace, cycle by cycle
//   2. RTL final registers + data memory == ISS final state
//   3. retired-instruction counts agree
// usage: node tools/check.mjs [program.s ...] [--iverilog <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { assemble, DMEM_BYTES } from '../web/js/rv32i/asm.js';
import { ISS } from '../web/js/rv32i/iss.js';
import { Pipeline } from '../web/js/rv32i/pipeline.js';
import { parseReg } from '../web/js/rv32i/isa.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const args = process.argv.slice(2);
const ivIdx = args.indexOf('--iverilog');
const ivDir = ivIdx >= 0 ? args.splice(ivIdx, 2)[1] : process.env.IVERILOG_DIR || 'C:/iverilog/bin';
const exe = (n) => path.join(ivDir, process.platform === 'win32' ? `${n}.exe` : n);

const build = path.join(root, 'build');
fs.mkdirSync(build, { recursive: true });

const rtl = ['rv_pkg', 'rv_decoder', 'rv_units', 'rv_hazard', 'rv_mem', 'rv_core', 'rv_top']
  .map((f) => path.join(root, 'rtl/rv32i', `${f}.sv`));
const vvp = path.join(build, 'rv32i.vvp');
execFileSync(exe('iverilog'), ['-g2012', '-o', vvp, ...rtl, path.join(root, 'sim/tb_rv32i.sv')], { stdio: ['ignore', 'ignore', 'pipe'] });

function listPrograms(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return listPrograms(p);
    return e.name.endsWith('.s') ? [p] : [];
  });
}
const programs = args.length ? args.map((a) => path.resolve(a)) : listPrograms(path.join(root, 'programs/rv32i'));

const words = (arr, n) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push(((arr[i] ?? 0) >>> 0).toString(16).padStart(8, '0'));
  return out.join('\n') + '\n';
};
const hex8 = (v) => (v >>> 0).toString(16).padStart(8, '0');

let failed = 0;
for (const file of programs) {
  const name = path.relative(root, file).replace(/\\/g, '/');
  const prog = assemble(fs.readFileSync(file, 'utf8'));
  if (prog.errors.length) {
    console.log(`FAIL ${name}: ${prog.errors.map((e) => `line ${e.line}: ${e.message}`).join('; ')}`);
    failed++;
    continue;
  }
  const dwords = new Int32Array(DMEM_BYTES / 4);
  new Uint8Array(dwords.buffer).set(prog.data.subarray(0, DMEM_BYTES));
  const ph = path.join(build, 'prog.hex'), dh = path.join(build, 'data.hex');
  fs.writeFileSync(ph, words(prog.text, 1024));
  fs.writeFileSync(dh, words(dwords, 1024));

  const out = execFileSync(exe('vvp'), ['-n', vvp, `+prog=${ph}`, `+data=${dh}`], { encoding: 'utf8', maxBuffer: 1 << 28 })
    .split(/\r?\n/).filter((l) => l && !l.includes('$finish'));
  const rtlTrace = out.filter((l) => /^\d+ F=/.test(l));
  const summary = out.find((l) => l.startsWith('halt='));
  const rtlState = out.filter((l) => /^(x\d+|m\[)/.test(l));

  const problems = [];

  // 1. trace
  const pipe = new Pipeline(prog);
  const jsTrace = [];
  pipe.run(100000, (p) => jsTrace.push(p.traceLine()));
  const n = Math.max(rtlTrace.length, jsTrace.length);
  for (let i = 0; i < n; i++) {
    if (rtlTrace[i] !== jsTrace[i]) {
      problems.push(`trace differs at line ${i}\n    rtl: ${rtlTrace[i] ?? '(end)'}\n    js:  ${jsTrace[i] ?? '(end)'}`);
      break;
    }
  }
  const jsSummary = `halt=${pipe.halted ?? 'timeout'} cycles=${pipe.cycle} retired=${pipe.retired}`;
  if (summary !== jsSummary) problems.push(`summary: rtl "${summary}" js "${jsSummary}"`);

  // 2. final state against the ISS
  const iss = new ISS(prog).run();
  const issState = [];
  for (let i = 1; i < 32; i++) if (iss.regs[i]) issState.push(`x${i}=${hex8(iss.regs[i])}`);
  for (let i = 0; i < 1024; i++) {
    const w = iss.mem.word(i);
    if (w) issState.push(`m[${hex8(i * 4)}]=${hex8(w)}`);
  }
  if (rtlState.join(' ') !== issState.join(' ')) {
    const a = new Set(rtlState), b = new Set(issState);
    problems.push(`state vs ISS: rtl-only [${rtlState.filter((x) => !b.has(x)).join(' ')}] iss-only [${issState.filter((x) => !a.has(x)).join(' ')}]`);
  }

  // 3. retired count
  const issHalt = iss.halted === 'ebreak' ? 'ecall' : iss.halted ?? 'timeout';
  const m = /halt=(\w+) cycles=(\d+) retired=(\d+)/.exec(summary || '');
  if (!m || m[1] !== issHalt || +m[3] !== iss.retired) problems.push(`halt/retired: rtl ${m ? `${m[1]}/${m[3]}` : '?'} iss ${issHalt}/${iss.retired}`);

  // 4. "# expect a0=2 m[0x10]=5" comments, checked against the ISS
  const src = fs.readFileSync(file, 'utf8');
  for (const line of src.matchAll(/^\s*#\s*expect\s+(.*)$/gm)) {
    for (const item of line[1].trim().split(/\s+/)) {
      const e = /^(?:m\[(\w+)\]|(\w+))=(\S+)$/.exec(item);
      if (!e) { problems.push(`bad expect "${item}"`); continue; }
      const want = Number(e[3]) >>> 0;
      let got;
      if (e[1] !== undefined) got = iss.mem.word(Number(e[1]) >>> 2) >>> 0;
      else {
        const r = parseReg(e[2]);
        if (r < 0) { problems.push(`bad register "${e[2]}"`); continue; }
        got = iss.regs[r] >>> 0;
      }
      if (got !== want) problems.push(`expect ${item}: got ${hex8(got)}`);
    }
  }

  if (problems.length) {
    failed++;
    console.log(`FAIL ${name}\n  ${problems.join('\n  ')}`);
  } else {
    console.log(`ok   ${name}  (${m[2]} cycles, ${m[3]} retired, CPI ${(m[2] / m[3]).toFixed(2)})`);
  }
}
console.log(failed ? `\n${failed} of ${programs.length} failed` : `\nall ${programs.length} passed`);
process.exit(failed ? 1 : 0);
