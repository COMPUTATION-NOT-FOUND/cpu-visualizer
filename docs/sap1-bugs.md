# SAP-1: what was wrong with the course versions

The original 8-bit SAP-1 went through three EDA Playground versions. They are kept
unchanged in [archive/eda-playground/](../archive/eda-playground/) as `sap1-v1`, `sap1-v2` and `sap1-v3`.
The clean rewrite is in [rtl/sap1/](../rtl/sap1/).

## Reproducing

```sh
node tools/old-sap1.mjs
```

Each version is copied into `build/`, compiled with Icarus and run on the program
baked into its RAM:

| Version | Program | Expected output | Actual output |
|---|---|---|---|
| v1 | `16 + 20 + 24 - 32`, then HLT | 28 | 28: passes |
| v2 | LDA, ADD, OUT, ADD, OUT, SUB, OUT (no HLT) | 44, 60, 28 | **44, 60, 93** |
| v3 | same as v2 | 44, 60, 28 | 44, 60, 28 |
| v3, HLT patched in at address 7 | same, then HLT | 44, 60, 28, stop | **44, 60, 28, halt raised, 44, 60, 28, …** |

## Bugs

**v1**
1. `state` is assigned in two always blocks: `@(posedge clk or posedge reset)` for the reset and `@(negedge clk)` for the next state. It simulates, but a synthesis tool rejects a register with two drivers.

**v2**

2. The tri-state bus drivers (`ACC`, `ADDSUB`, `RAM`, `PC`, `RegIR`) are written as `always @(e) out = e ? data : 'z;`. Since the sensitivity list holds only the enable, the driver keeps the value it saw when the enable changed and misses later changes to the data. In `SUB`, the adder output goes onto the bus before it has switched to subtraction, so `60 - 32` comes out as **93**.

**v3** (fixed bug 2 with `assign` and a bus multiplexer)

3. **HLT doesn't stop the CPU.** State `T15` sets `halt = 1` and nothing else. Only the testbench reads `halt`; the clock, PC and registers carry on. `halt` is never cleared, so it is a latch. In `T15`, `cs_out` keeps its previous value, which is another latch.
4. The program counter counts `(count + 1) % 8`. Only addresses 0–7 can hold code, out of 16 bytes of RAM.
5. The bus multiplexer is selected by the *whole* 12-bit control word (`case (controlbus) 12'h1A3: …`) rather than by the individual enable bits. Any new control word puts nothing on the bus, so the design can't be extended without editing the multiplexer.
6. The control-bus comment in `design.sv` swaps bits 4 and 5 (`!ea` and `!la`). The wiring is correct but the comment is wrong.

**All versions**

7. The program is hard-coded in `initial` blocks inside the RAM module, so trying another program means editing the RTL.
8. The testbench checks a fixed cycle count or one final value, so the trace is never compared against a reference.

## The rewrite

- [sap1_ctrl.sv](../rtl/sap1/sap1_ctrl.sv) is one ring counter T0–T5, as in Malvino. Every instruction takes 6 T-states and the controls are decoded from (T-state, opcode). HLT freezes the counter, so nothing else changes.
- [sap1_core.sv](../rtl/sap1/sap1_core.sv) has one bus multiplexer selected by the enable bits. The PC is a full 4 bits. Reset is synchronous and active-high everywhere.
- The RAM is loaded with `$readmemh` from `+prog=<file>`.
- Unknown opcodes 3–13 act as a NOP: fetch only.
- `node tools/check-sap1.mjs` assembles each program in `programs/sap1`, then checks the Icarus trace against the JavaScript model, one T-state at a time. It then checks the result against an instruction-level reference and any `; expect` lines.
