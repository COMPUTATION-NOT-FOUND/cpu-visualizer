// Runs the archived SAP-1 versions (archive/eda-playground/sap1-v1..v3) in Icarus
// and prints what each one outputs, to back up docs/sap1-bugs.md.
// Every version has its program baked into its RAM module:
//   v1: LDA 9, ADD 10, ADD 11, SUB 12, OUT, HLT          (16+20+24-32 = 28)
//   v2/v3: LDA 9, ADD 10, OUT, ADD 8, OUT, SUB 11, OUT    (44, 60, 28), no HLT
// v3 is also run with address 7 patched to HLT, to show that HLT doesn't stop it.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const ivDir = process.env.IVERILOG_DIR || 'C:/iverilog/bin';
const exe = (n) => path.join(ivDir, process.platform === 'win32' ? `${n}.exe` : n);

const watch = `module tb_watch;
  logic clk = 1, rst; logic [7:0] o; logic h;
  Sap1 uut(.clksap(clk), .resetsap(rst), .outsap(o), .halt(h));
  always #5 clk = ~clk;
  initial begin rst = 1; #10 rst = 0; repeat (120) @(posedge clk); $finish; end
  always @(o) if ($time > 0) $display("out %0d", o);
  always @(posedge h) $display("halt raised");
endmodule
`;

function run(version, patch) {
  const dir = path.join(root, 'build', `old-sap1-${version}${patch ? '-hlt' : ''}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(path.join(root, 'archive/eda-playground', `sap1-${version}`), dir, { recursive: true });
  let top = 'testbench.sv';
  if (version !== 'v1') {
    fs.writeFileSync(path.join(dir, 'tb_watch.sv'), watch);
    top = 'tb_watch.sv';
  }
  if (patch) {
    const ram = path.join(dir, 'Ram.sv');
    fs.writeFileSync(ram, fs.readFileSync(ram, 'utf8').replace(/RAM\[7\] <= 8'h00;/, "RAM[7] <= 8'hF0;"));
  }
  execFileSync(exe('iverilog'), ['-g2012', '-o', 'a.vvp', 'design.sv', top], { cwd: dir, stdio: 'ignore' });
  const out = execFileSync(exe('vvp'), ['-n', 'a.vvp'], { cwd: dir, encoding: 'utf8' });
  return out.split(/\r?\n/).filter((l) => /^(out|halt|Test|Time = \d+ \| Binary)/.test(l));
}

for (const [v, patch, note] of [
  ['v1', false, 'expects 28, then HLT'],
  ['v2', false, 'expects 44, 60, 28 repeating'],
  ['v3', false, 'expects 44, 60, 28 repeating'],
  ['v3', true, 'expects 44, 60, 28, then stop'],
]) {
  console.log(`== sap1-${v}${patch ? ' with HLT at address 7' : ''} (${note})`);
  for (const l of run(v, patch).slice(0, 8)) console.log('   ' + l);
}
