# Bugs in the original RISC-V pipeline

The course pipeline (kept unchanged in
[archive/eda-playground/riscv-pipeline-v2](../archive/eda-playground/riscv-pipeline-v2))
followed the five-stage design in Harris & Harris, *Digital Design and Computer
Architecture: RISC-V Edition*. Parts of it were left for students to finish, and those
parts had the bugs below. The rewrite in [rtl/rv32i](../rtl/rv32i) fixes all of them.

## Reproducing them

```sh
node tools/old-rtl.mjs   # runs programs/rv32i/bugs/*.s on the OLD core: every one should say "reproduced"
node tools/check.mjs     # runs every program on the NEW core: every one should pass
```

`old-rtl.mjs` copies the archived sources into `build/old-rtl/` and changes one thing:
the hard-coded program in `Instruction_Memory.sv` becomes a `$readmemh`. The old core
has no halt, so it runs 60 cycles and then the script compares registers against the
program's `# expect` line.

| Program | Old result | Expected |
|---|---|---|
| [01-branch-compare.s](../programs/rv32i/bugs/01-branch-compare.s) | `beq` taken for 1 vs 2 (a0 never written), `bne` not taken (a2=33) | a0=11, a2=0 |
| [02-store-data.s](../programs/rv32i/bugs/02-store-data.s) | stored value is `x`, so a0=x | a0=42 |
| [03-jal-offset.s](../programs/rv32i/bugs/03-jal-offset.s) | `jal` lands short; the skipped `li`s run | a0=a1=0 |
| [04-slt-signed.s](../programs/rv32i/bugs/04-slt-signed.s) | slt, sltu, srai, srli, slli all give 0 | 1, 1, -1, 0x7fffffff, -4 |
| [05-load-use.s](../programs/rv32i/bugs/05-load-use.s) | the load is lost during the stall: t0, a0, a1 = x | 1, 2, 7 |

## The bugs

1. **Branch decision.** Branches were decided from the ALU's zero/negative flags
   combined with `funct3[0]`. That inverted `beq`/`bne` for some operands, and `bltu`/`bgeu`
   were not supported. Fix: a separate comparator (`rv_branch`) for all six conditions.
2. **Store data not connected.** The rs2 value never reached the Execute pipeline
   register, so every store wrote `x`. Fix: forwarded rs2 travels with the instruction
   to Memory as `writeDataM`.
3. **J-type immediate.** The immediate was built without its implicit low zero bit,
   so `jal` jumped half the distance. Fix in `rv_imm`.
4. **Stall and flush on the control register.** During a load-use stall the control
   pipeline register cleared the wrong stage, killing the load itself as well as the
   bubble behind it. Fix: one hazard unit (`rv_hazard`) drives `stallF`, `stallD`,
   `flushD` and `flushE`, and stalls never touch Memory or Writeback.
5. **ALU coverage.** `slt` compared unsigned. `xor`, the shifts (`sll`, `srl`,
   `sra` and their immediate forms) and `sltu` were missing. Fix: complete `rv_alu`.
6. **Decoder gaps.** An unknown opcode gave `x` controls instead of a defined result,
   and `lui`, `auipc` and byte/halfword loads and stores were not decoded. Fix: the
   decoder covers all of RV32I. Anything else halts the core as an illegal instruction.
7. **Instruction memory and `jalr`.** The instruction memory had a `+4` address
   workaround that hid a fetch timing problem, and `jalr` did not clear bit 0 of the
   target. Fix: the fetch path is aligned with the book's design, and the target is `(rs1 + imm) & ~1`.
8. **`=== 1'bx` guards.** Several modules tested signals against `x` to patch over
   undriven values. Synthesis ignores those checks. Fix: every signal is driven and
   every register resets.
9. **Forwarding the wrong value for `jal`/`jalr`.** Forwarding from Memory used the
   ALU result, so an instruction right after a call saw the jump target instead of the
   return address. Fix: Execute picks `pc + 4` for jumps before the value enters the
   pipeline (`exResultE`).
10. **Register file on the falling edge.** Writing on the negative edge made the
    timing differ from the book and from the model. Fix: write on the rising edge and
    pass the value being written straight through to the reads in the same cycle.

## How the fixed core is checked

`tools/check.mjs` assembles each program in `programs/rv32i/` and checks it three ways:

- the Icarus Verilog trace of the RTL, compared cycle by cycle with the JavaScript
  pipeline model that drives the website;
- the RTL's final registers and memory against an instruction-set simulator;
- the program's own `# expect` values.
