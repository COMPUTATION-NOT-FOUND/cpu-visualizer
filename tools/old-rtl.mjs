// Runs programs/rv32i/bugs/*.s on the ORIGINAL course pipeline
// (archive/eda-playground/riscv-pipeline-v2) to show each bug still reproduces there.
// A bug counts as reproduced when the old core's registers miss the "# expect" values.
// usage: node tools/old-rtl.mjs [program.s ...] [--iverilog <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { assemble } from '../web/js/rv32i/asm.js';
import { parseReg } from '../web/js/rv32i/isa.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const args = process.argv.slice(2);
const ivIdx = args.indexOf('--iverilog');
const ivDir = ivIdx >= 0 ? args.splice(ivIdx, 2)[1] : process.env.IVERILOG_DIR || 'C:/iverilog/bin';
const exe = (n) => path.join(ivDir, process.platform === 'win32' ? `${n}.exe` : n);

// Copy the old sources, swapping the hard-coded program for a $readmemh.
const src = path.join(root, 'archive/eda-playground/riscv-pipeline-v2');
const work = path.join(root, 'build/old-rtl');
fs.mkdirSync(work, { recursive: true });
for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.sv') && f !== 'testbench.sv')) {
  let text = fs.readFileSync(path.join(src, f), 'utf8');
  if (f === 'Instruction_Memory.sv') {
    text = text.replace(/initial[\s\S]*?\bend\b/,
      'initial begin string f; if (!$value$plusargs("prog=%s", f)) f = "prog.hex"; $readmemh(f, RAM); end');
  }
  fs.writeFileSync(path.join(work, f), text);
}
// The old core has no halt, so run a fixed number of cycles and dump the registers.
fs.writeFileSync(path.join(work, 'tb_old.sv'), `\`include "design.sv"
module tb;
  logic clk = 0, reset = 1;
  logic [31:0] WriteData, DataAdr; logic MemWrite;
  top dut(clk, reset, WriteData, DataAdr, MemWrite);
  always #5 clk = ~clk;
  initial begin
    #12 reset = 0;
    repeat (60) @(posedge clk);
    for (int i = 1; i < 32; i++) $display("x%0d=%h", i, dut.rvsingle.dp.rf.rf[i]);
    $finish;
  end
endmodule
`);
const vvp = path.join(work, 'old.vvp');
execFileSync(exe('iverilog'), ['-g2012', '-I', work, '-o', vvp, path.join(work, 'tb_old.sv')], { stdio: ['ignore', 'ignore', 'pipe'] });

const dir = path.join(root, 'programs/rv32i/bugs');
const programs = args.length ? args.map((a) => path.resolve(a)) : fs.readdirSync(dir).filter((f) => f.endsWith('.s')).sort().map((f) => path.join(dir, f));

let missed = 0;
for (const file of programs) {
  const name = path.relative(root, file).replace(/\\/g, '/');
  const text = fs.readFileSync(file, 'utf8');
  const prog = assemble(text);
  // The old imem holds 64 words; pad with nops so it never fetches x.
  const words = Array.from({ length: 64 }, (_, i) => ((prog.text[i] ?? 0x13) >>> 0).toString(16).padStart(8, '0'));
  const hex = path.join(work, 'prog.hex');
  fs.writeFileSync(hex, words.join('\n') + '\n');
  const out = execFileSync(exe('vvp'), ['-n', vvp, `+prog=${hex}`], { encoding: 'utf8' });
  const regs = {};
  for (const m of out.matchAll(/^x(\d+)=(\S+)/gm)) regs[m[1]] = m[2];

  const wrong = [];
  for (const line of text.matchAll(/^\s*#\s*expect\s+(.*)$/gm)) {
    for (const item of line[1].trim().split(/\s+/)) {
      const e = /^(\w+)=(\S+)$/.exec(item);
      if (!e || parseReg(e[1]) < 0) continue; // memory checks are skipped: the old dmem is preloaded
      const want = (Number(e[2]) >>> 0).toString(16).padStart(8, '0');
      const got = regs[parseReg(e[1])];
      if (got !== want) wrong.push(`${e[1]}=${got} (want ${want})`);
    }
  }
  if (wrong.length) console.log(`reproduced  ${name}: ${wrong.join(', ')}`);
  else { missed++; console.log(`NOT reproduced  ${name}`); }
}
process.exit(missed ? 1 : 0);
