// Runs every program in web/js/guide-samples.js and checks its `expect` values:
// SAP-1 on the instruction-level reference, RV32I on both the ISS and the pipeline.
//   node tools/check-guide.mjs
import { SAMPLES } from '../web/js/guide-samples.js';
import { assemble as asmSap } from '../web/js/sap1/asm.js';
import { reference } from '../web/js/sap1/sim.js';
import { assemble as asmRv } from '../web/js/rv32i/asm.js';
import { ISS } from '../web/js/rv32i/iss.js';
import { Pipeline } from '../web/js/rv32i/pipeline.js';
import { parseReg } from '../web/js/rv32i/isa.js';

let bad = 0;
const fail = (name, msg) => { bad++; console.log(`FAIL ${name}: ${msg}`); };

for (const [name, s] of Object.entries(SAMPLES.sap1)) {
  const p = asmSap(s.source);
  if (p.errors.length) { fail(`sap1/${name}`, JSON.stringify(p.errors)); continue; }
  const r = reference(p.mem);
  if (!r.halted) fail(`sap1/${name}`, 'did not halt');
  if (String(r.outputs) !== String(s.expect.outputs)) fail(`sap1/${name}`, `outputs ${r.outputs} != ${s.expect.outputs}`);
  else console.log(`ok   sap1/${name}`);
}

for (const [name, s] of Object.entries(SAMPLES.rv32i)) {
  const p = asmRv(s.source);
  if (p.errors.length) { fail(`rv32i/${name}`, JSON.stringify(p.errors)); continue; }
  const iss = new ISS(p);
  for (let i = 0; i < 100000 && iss.step(); i++);
  const pl = new Pipeline(p);
  for (let i = 0; i < 200000 && pl.step(); i++);
  let ok = true;
  for (const [who, m] of [['iss', iss], ['pipeline', pl]]) {
    const halted = who === 'iss' ? iss.halted : pl.halted;
    if (halted !== 'ecall') { fail(`rv32i/${name}`, `${who} halted with ${halted}`); ok = false; }
    for (const [r, v] of Object.entries(s.expect.regs || {})) {
      if (m.regs[parseReg(r)] !== v) { fail(`rv32i/${name}`, `${who} ${r}=${m.regs[parseReg(r)]} want ${v}`); ok = false; }
    }
    for (const [a, v] of Object.entries(s.expect.mem || {})) {
      const got = m.mem.load(Number(a), 2);
      if (got !== v) { fail(`rv32i/${name}`, `${who} mem[${a}]=${got} want ${v}`); ok = false; }
    }
  }
  if (ok) console.log(`ok   rv32i/${name}`);
}
process.exit(bad ? 1 : 0);
