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

Live site: https://computation-not-found.github.io/cpu-visualizer/

## Using it

1. Pick **SAP-1** or **RISC-V** at the top.
2. Choose a program from **Load an example…**, or type your own in the editor.
3. Press **Assemble**. Errors are listed with their line number.
4. Step through it with **Forward** and **Back**. The **by Clock / Instruction** switch sets how far
   each press moves: one clock (a T-state on SAP-1, a cycle on RISC-V), or up to the end of
   the next instruction. Back goes all the way to the start, so you can stop anywhere and read
   the screen.
5. Or press **Run** to play it at the chosen speed (1 Hz up to max).

| Control | Key | What it does |
|---|---|---|
| Forward | `→` | step forward by the chosen amount |
| Back | `←` or `B` | step back by the chosen amount |
| (one clock) | `S` | one clock edge, whatever the switch says |
| (one instruction) | `I` | run until the next instruction finishes |
| Run / Pause | `R` | run at the chosen speed |
| Reset | `Z` | reload the program |
| Assemble | `Ctrl+Enter` | assemble the editor contents |
| Guide | `?` | open the in-site guide |

**Share** copies a link that holds the CPU, the source code and the current cycle.
The **Guide** button opens a longer tutorial with runnable samples for both CPUs.

## Writing programs

### SAP-1

Every line has at most one instruction. A label ends with `:` and a comment starts with `;` or `#`.

```
label:  MNEMONIC operand    ; comment
```

| Instruction | Opcode | What it does |
|---|---|---|
| `LDA addr` | 0 | A ← RAM[addr] |
| `ADD addr` | 1 | B ← RAM[addr]; A ← A + B |
| `SUB addr` | 2 | B ← RAM[addr]; A ← A − B |
| `OUT` | E | output register ← A |
| `HLT` | F | stop the clock |
| `.byte v, v…` (or `DB`) | | put data bytes here |
| `.org addr` (or `ORG`) | | continue at this address |

Things to know:

- **16 bytes in total.** RAM (addresses 0 to 15) holds the program and its data, and each
  instruction is one byte.
- **Operands** are a label or a number: `42`, `0x2A`, `2Ah` or `0b101010`.
- **Values are 8-bit** and wrap around: 250 + 10 gives 4, and 3 − 5 gives 254.
- **No jumps, compares or stores**, so a program runs straight from top to bottom.
  To multiply, repeat the `ADD`.
- **Always end with `HLT`.** Without it the CPU runs on into your data and executes it.

To turn a calculation into a program, give each number a label and a `.byte` line below the
code. Then `LDA` the first number, `ADD` or `SUB` the others, and finish with `OUT` and `HLT`:

```
; result = 7 + 9 - 3
        LDA a        ; A = 7
        ADD b        ; A = A + 9
        SUB c        ; A = A - 3
        OUT          ; show A on the output register (13)
        HLT
a:      .byte 7
b:      .byte 9
c:      .byte 3
```

### RISC-V (RV32I)

Standard RISC-V assembly. Comments start with `#`.

```
label:  mnemonic rd, rs1, rs2/imm    # comment
```

| Kind | Instructions | Example |
|---|---|---|
| Arithmetic | `add sub and or xor sll srl sra slt sltu` | `add t0, t1, t2` → t0 = t1 + t2 |
| With a constant | `addi andi ori xori slli srli srai slti sltiu` | `addi t0, t0, 1` → t0 = t0 + 1 |
| Load | `lw lh lhu lb lbu` | `lw t0, 8(s0)` → t0 = word at s0 + 8 |
| Store | `sw sh sb` | `sw t0, 8(s0)` → word at s0 + 8 = t0 |
| Branch | `beq bne blt bge bltu bgeu` | `blt t0, t1, loop` → go to loop if t0 < t1 |
| Jump | `jal jalr` | `jal ra, f` → ra = pc + 4, go to f |
| Upper immediate | `lui auipc` | `lui t0, 0x12345` → t0 = 0x12345000 |
| Stop | `ecall ebreak` | |

Pseudo-instructions: `li`, `la`, `mv`, `not`, `neg`, `j`, `jr`, `call`, `tail`, `ret`, `nop`,
`bgt ble bgtu bleu`, `beqz bnez blez bgez bltz bgtz`, `seqz snez sltz sgtz`.

| Register | Number | Use it for |
|---|---|---|
| `zero` | x0 | always 0; writes are ignored |
| `ra` | x1 | return address, set by `call` / `jal` |
| `sp` | x2 | stack pointer. It starts at 0, so do `li sp, 4096` before you use the stack |
| `t0`–`t6` | x5–7, x28–31 | temporaries; a called function may overwrite them |
| `s0`–`s11` | x8–9, x18–27 | values that must survive a call |
| `a0`–`a7` | x10–17 | arguments; `a0` also holds the return value |

Things to know:

- **Sections:** `.text` holds instructions and `.data` holds variables. Each memory is 4 KiB
  and starts at address 0.
- **Data directives:** `.word`, `.half`, `.byte`, `.space n`, `.ascii "hi"`, `.align n` and `.equ NAME, value`.
- **Numbers:** `42`, `-7`, `0x2A`, `'A'`, expressions like `4*8+1`, and `%hi(x)` / `%lo(x)`.
- **Immediates** must fit in 12 bits (−2048 to 2047). Use `li` for bigger constants.
- **No `mul` or `div`** in RV32I. Use shifts (`slli t0, t0, 3` is ×8) or a loop of adds.
- **Word arrays:** element `i` is at `base + i*4`, so use `slli t, i, 2` before adding it to the base.
- **End with `ecall`.** Without it, fetch runs into empty memory and the core stops on an illegal instruction.

#### From pseudocode to assembly

Pick a register for each variable, write the mapping in a comment, and translate one line at a time:

| Pseudocode | RV32I |
|---|---|
| `x = 5` | `li t0, 5` |
| `x = y + z` | `add t0, t1, t2` |
| `x = y + 3` | `addi t0, t1, 3` |
| `x = y * 8` | `slli t0, t1, 3` |
| `x = A[i]` | `slli t3, t1, 2` · `add t3, s0, t3` · `lw t0, 0(t3)` |
| `if a < b: …` | `bge a, b, skip` · `…` · `skip:` (branch on the **opposite** test) |
| `while a != b: …` | `top: beq a, b, done` · `…` · `j top` · `done:` |
| `r = f(x)` | `mv a0, x` · `call f` · `mv r, a0` |
| `return v` | `mv a0, v` · `ret` |

Example: a `for` loop that adds 1 to 10.

```
# sum = 0
# for i = 1 to 10: sum = sum + i
#
# registers: a0 = sum, t0 = i, t1 = 10
        li   a0, 0          # sum = 0
        li   t0, 1          # i = 1
        li   t1, 10
loop:   bgt  t0, t1, done   # leave the loop when i > 10
        add  a0, a0, t0     # sum = sum + i
        addi t0, t0, 1      # i = i + 1
        j    loop
done:   ecall               # stop: a0 holds 55
```

Example: `if / else` with values in memory.

```
# if a > b: max = a  else: max = b, then store max at "result"
        .data
a:      .word 17
b:      .word 42
result: .word 0
        .text
        la   t0, a
        lw   t1, 0(t0)       # t1 = a
        lw   t2, 4(t0)       # t2 = b
        ble  t1, t2, else    # branch on the OPPOSITE test
        mv   a0, t1          # then: max = a
        j    endif
else:   mv   a0, t2          # else: max = b
endif:  la   t3, result
        sw   a0, 0(t3)       # result = max
        ecall
```

When the answer is wrong, set **by Instruction** and step **Forward** while you watch the
register you expect to change, then step **Back** to the moment it went wrong.

### `expect` lines

The example programs start with a comment such as `; expect a=56 out=56` or `# expect a0=89 m[0x2c]=89`.
Only the test tools in `tools/` read these lines, to check the result. The CPU ignores them,
and your own programs don't need them.

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
