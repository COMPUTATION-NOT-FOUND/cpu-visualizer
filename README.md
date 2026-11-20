# CPU Visualizer

Write assembly in the browser and step it through two processors one clock at a time:

- **SAP-1**: an 8-bit, single-bus computer (the Malvino "Simple As Possible" design) driven by
  microcode. You can watch every control signal, bus transfer and register.
- **RV32I 5-stage pipeline**: the classic Fetch / Decode / Execute / Memory / Writeback core
  with forwarding, load-use stalls and branch flushes. It shows a datapath diagram, a pipeline
  chart, the hazard signals and the register and memory state.

There is no build step: `web/` is a static site made of plain ES modules.

```sh
python tools/serve.py                   # then open http://localhost:8000 (caching off)
```

## Using it

| Control | Key | What it does |
|---|---|---|
| Clock | `S` | one clock edge |
| Instruction | `I` | run until the next instruction finishes |
| Run / Pause | `R` | run at the chosen speed |
| Back | `B` | undo one clock (keeps the last 2000) |
| Reset | `Z` | reload the program |
| Assemble | `Ctrl+Enter` | assemble the editor contents |

**Share** copies a link that holds the CPU, the source code and the current cycle.

## How it is checked

The simulators in `web/js/sap1` and `web/js/rv32i` are JavaScript models of the
SystemVerilog in `rtl/`. To keep them in step, the tools below run the same programs on
both and compare the results cycle by cycle. They need [Icarus Verilog](https://steveicarus.github.io/iverilog/)
(`-g2012`). Set `IVERILOG_DIR` if it is not in `C:/iverilog/bin`.

```sh
node tools/check.mjs              # RV32I: JS model vs RTL on programs/rv32i/**
node tools/check-sap1.mjs         # SAP-1: JS model vs RTL on programs/sap1/**
node tools/gen-examples.mjs --check   # web/js/examples.js matches programs/*/examples
node tools/check-guide.mjs        # every program in the in-site guide gives its stated result
node tools/old-rtl.mjs            # reproduces the original pipeline's bugs on the archived core
```

CI runs the first three on every push and pull request.

## Layout

```
rtl/        SystemVerilog for both cores
sim/        testbenches
programs/   example, test and bug-regression programs (.s)
web/        the site
tools/      assemblers, RTL checks, example generator
docs/       notes on the bugs fixed in the original course designs
archive/    the original course code, unchanged
```

## Credits

- The RISC-V pipeline follows the five-stage design in Sarah L. Harris and David Money Harris,
  *Digital Design and Computer Architecture: RISC-V Edition*. The original course version left
  parts of it for students to implement. [docs/pipeline-bugs.md](docs/pipeline-bugs.md) lists the
  bugs in that version, and `rtl/rv32i` fixes them.
- The SAP-1 is a classic Digital Logic Design course project, taught by Sir Salman Zaffar at IBA
  Karachi and based on Albert Paul Malvino's *Digital Computer Electronics*.
  [docs/sap1-bugs.md](docs/sap1-bugs.md) covers the fixes.
- The original code is kept in [archive/eda-playground](archive/eda-playground).
