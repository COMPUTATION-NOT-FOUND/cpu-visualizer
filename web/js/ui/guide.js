// The guide: how to read the screen and how to write your own programs, per CPU.
// Sample programs come from guide-samples.js and open in the editor with one click.
import { SAMPLES } from '../guide-samples.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function sample(cpu, id) {
  const s = SAMPLES[cpu][id];
  return `<figure class="g-sample">
    <figcaption><span>${esc(s.title)}</span>
      <button type="button" data-open="${cpu}:${id}">Open in editor</button></figcaption>
    <pre>${esc(s.source.trimEnd())}</pre></figure>`;
}

const table = (head, rows) => `<table class="g-table"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

const steps = (items) => `<ol class="g-steps">${items.map((x) => `<li>${x}</li>`).join('')}</ol>`;

// --- SAP-1 ----------------------------------------------------------------------------------

const SAP1 = [
  ['start', 'Getting started', `
    <p>The SAP-1 is the smallest computer that still works like a real one: an 8-bit accumulator, 16 bytes of memory
    and five instructions. Every instruction takes six clock ticks (T-states), and you can watch each one.</p>
    ${steps([
      'Pick a program from <b>Load an example…</b> or type your own in the editor.',
      'Press <b>Assemble</b> (<kbd>Ctrl</kbd>+<kbd>Enter</kbd>). Mistakes are listed under the editor with their line number.',
      'Use <b>Forward</b> (<kbd>→</kbd>) and <b>Back</b> (<kbd>←</kbd>) to move through the program at your own pace. <b>by Clock</b> moves one T-state per press, <b>by Instruction</b> moves a whole instruction (six T-states).',
      'You can go back as far as you like, to the very first clock, and read each step again. <kbd>S</kbd> and <kbd>I</kbd> always step forward one clock or one instruction.',
      '<b>Run</b> (<kbd>R</kbd>) plays it at the chosen speed and <b>Reset</b> (<kbd>Z</kbd>) starts over.',
      'Read the answer from the <b>OUT</b> register. Every value it shows is kept in the output list.',
    ])}`],
  ['screen', 'Reading the screen', `
    ${table(['Part', 'What it shows'], [
      ['Bus', 'The single 8-bit W bus. Only one block drives it in each T-state. That block is shown in orange and the block that loads it in blue.'],
      ['PC', 'Program counter: the address of the next instruction.'],
      ['MAR / RAM', 'The address register and the 16-byte memory it selects.'],
      ['IR', 'Instruction register. The top 4 bits are the opcode and the bottom 4 bits are the address.'],
      ['A, B, ALU', 'The accumulator, the second operand and the adder/subtractor that combines them.'],
      ['OUT', 'The output register. <code>OUT</code> copies A here.'],
      ['Control word', 'The 12 control signals (Cp, Ep, LM…) that the microcode turns on in this T-state.'],
      ['Timing', 'A waveform of the clock and control signals for the last 40 clocks.'],
    ])}
    <p>T1 to T3 fetch the instruction for every opcode: PC → MAR, RAM → IR, PC + 1. T4 to T6 depend on the opcode.</p>`],
  ['write', 'Writing a program', `
    <p>Each line holds at most one instruction or directive. A line can start with a label and end with a comment.</p>
    <pre class="g-syntax">label:  MNEMONIC operand    ; comment</pre>
    ${table(['Instruction', 'Opcode', 'What it does'], [
      ['<code>LDA addr</code>', '0', 'A ← RAM[addr]'],
      ['<code>ADD addr</code>', '1', 'B ← RAM[addr]; A ← A + B'],
      ['<code>SUB addr</code>', '2', 'B ← RAM[addr]; A ← A − B'],
      ['<code>OUT</code>', 'E', 'OUT ← A'],
      ['<code>HLT</code>', 'F', 'stop the clock'],
      ['<code>.byte v, v…</code>', '', 'put data bytes here (also <code>DB</code>)'],
      ['<code>.org addr</code>', '', 'carry on at this address (also <code>ORG</code>)'],
    ])}
    ${table(['Rule', 'Detail'], [
      ['Memory', '16 bytes (addresses 0–15) hold the program <i>and</i> its data. Each instruction is one byte.'],
      ['Operands', 'An address is a label or a number: <code>42</code>, <code>0x2A</code>, <code>2Ah</code> or <code>0b101010</code>.'],
      ['Arithmetic', '8 bits, so results wrap around: 250 + 10 gives 4, and 3 − 5 gives 254.'],
      ['Comments', 'They start with <code>;</code> or <code>#</code>. Labels end with <code>:</code> and ignore case.'],
      ['Stop', 'Always end with <code>HLT</code>. Without it the CPU runs on into your data and treats it as instructions.'],
    ])}`],
  ['pseudo', 'From pseudocode to SAP-1', `
    <p>SAP-1 has no jumps, no compare and no store, so a program runs straight from top to bottom.
    That still covers any sum or difference of constants:</p>
    ${steps([
      'Write the calculation, for example <code>result = 7 + 9 − 3</code>.',
      'Give every number a label and a <code>.byte</code> line below the code.',
      'Load the first number with <code>LDA</code>, then use <code>ADD</code> or <code>SUB</code> for each of the others.',
      'Use <code>OUT</code> wherever you want to see a value, and finish with <code>HLT</code>.',
      'Count the bytes: instructions plus data must fit in 16.',
    ])}
    ${sample('sap1', 'expression')}
    <p>To multiply by a small constant, repeat the addition. To show partial results, put an <code>OUT</code> after each step.</p>
    ${sample('sap1', 'multiply')}
    ${sample('sap1', 'org')}`],
  ['errors', 'Fixing mistakes', `
    ${table(['Message or symptom', 'Cause and fix'], [
      ['<code>program does not fit in 16 bytes</code>', 'Too many instructions plus data bytes. Reuse a value, or drop an <code>OUT</code>.'],
      ['<code>value … does not fit in a byte</code>', 'Data must be −128 to 255.'],
      ['Unknown label', 'Check the spelling and that the label line ends with <code>:</code>.'],
      ['The CPU never halts, or does odd things', 'You left out <code>HLT</code>, or <code>.org</code> made code and data overlap.'],
      ['Wrong answer', 'Set <b>by Instruction</b>, press <b>Forward</b> and check A after each line. Press <b>Back</b> to replay the step that went wrong, then switch to <b>by Clock</b> to see it T-state by T-state.'],
    ])}`],
];

// --- RV32I ----------------------------------------------------------------------------------

const RV = [
  ['start', 'Getting started', `
    <p>This is a 32-bit RISC-V core (the RV32I base set) with the classic five-stage pipeline:
    <b>IF</b> fetch, <b>ID</b> decode and read registers, <b>EX</b> ALU and branches, <b>MEM</b> load/store, <b>WB</b> write back.
    Up to five instructions are in flight at once, one in each stage.</p>
    ${steps([
      'Pick a program from <b>Load an example…</b>, open one of the samples in this guide, or write your own.',
      'Press <b>Assemble</b> (<kbd>Ctrl</kbd>+<kbd>Enter</kbd>). Errors are listed with their line number.',
      'Press <b>Forward</b> (<kbd>→</kbd>) to advance and <b>Back</b> (<kbd>←</kbd>) to go back. With <b>by Clock</b> each press is one cycle, and the editor marks the line in each stage. With <b>by Instruction</b> each press runs until the next instruction finishes.',
      'You can step back as far as the first cycle, so pause anywhere and read the screen. <b>Run</b> (<kbd>R</kbd>) plays it at the chosen speed.',
      'Read the results in <b>Registers</b> and <b>Data memory</b>. Values that changed are highlighted.',
    ])}
    ${sample('rv32i', 'sum')}`],
  ['screen', 'Reading the screen', `
    ${table(['Part', 'What it shows'], [
      ['Pipeline', 'The five stages with the instruction in each and the values it is using. <i>bubble</i> means the stage is empty.'],
      ['F/D, D/E, E/M, M/W', 'The pipeline registers between the stages. Hatched red means the register was flushed and dashed means it is holding (stalled).'],
      ['Hazard unit', 'Compares register numbers across the stages and drives the forwarding, stall and flush signals. Its lit wires are the ones active this cycle, and the line inside it explains why.'],
      ['Orange arrows', 'Forwarding: a result goes from MEM or WB straight into EX, so the instruction doesn\'t have to wait for it to be written back.'],
      ['Red arrow over the top', 'A taken branch or jump sends the new PC to Fetch.'],
      ['Pipeline chart', 'One row per fetched instruction and one column per cycle. CPI = cycles ÷ instructions finished.'],
      ['Hazard signals', 'A waveform of stallF, stallD, flushD, flushE, pcSrc and the forwarding selects.'],
    ])}
    ${sample('rv32i', 'hazards')}`],
  ['write', 'Writing a program', `
    <pre class="g-syntax">label:  mnemonic rd, rs1, rs2/imm    # comment</pre>
    ${table(['Rule', 'Detail'], [
      ['Sections', '<code>.text</code> holds instructions and <code>.data</code> holds variables. Both memories are 4 KiB and start at address 0.'],
      ['Data', '<code>.word 1, 2</code> (4 bytes each), <code>.half</code>, <code>.byte</code>, <code>.space n</code>, <code>.ascii "hi"</code>, <code>.align n</code>, <code>.equ NAME, value</code>.'],
      ['Numbers', '<code>42</code>, <code>-7</code>, <code>0x2A</code>, <code>\'A\'</code>. Arithmetic works too: <code>4*8+1</code>, <code>%hi(x)</code>, <code>%lo(x)</code>.'],
      ['Immediates', 'Fit in 12 bits (−2048 to 2047). For bigger constants use <code>li</code>, which builds the value for you.'],
      ['Stop', 'End with <code>ecall</code> (or <code>ebreak</code>). Without it, fetch runs into empty memory, which decodes as an illegal instruction.'],
      ['No multiply', 'RV32I has no <code>mul</code> or <code>div</code>. Use shifts (<code>slli</code> by k multiplies by 2<sup>k</sup>) or a loop of adds.'],
    ])}
    <h4>Registers</h4>
    ${table(['Name', 'Number', 'Use it for'], [
      ['<code>zero</code>', 'x0', 'always 0; writes are ignored'],
      ['<code>ra</code>', 'x1', 'return address, set by <code>call</code> / <code>jal</code>'],
      ['<code>sp</code>', 'x2', 'stack pointer. It starts at 0, so set it with <code>li sp, 4096</code> before you use the stack'],
      ['<code>t0</code>–<code>t6</code>', 'x5–7, x28–31', 'temporaries; a called function may overwrite them'],
      ['<code>s0</code>–<code>s11</code>', 'x8–9, x18–27', 'saved values that should survive a call'],
      ['<code>a0</code>–<code>a7</code>', 'x10–17', 'function arguments; <code>a0</code> also holds the return value'],
    ])}
    <h4>Instructions</h4>
    ${table(['Kind', 'Instructions', 'Example'], [
      ['Arithmetic', '<code>add sub and or xor sll srl sra slt sltu</code>', '<code>add t0, t1, t2</code> → t0 = t1 + t2'],
      ['With a constant', '<code>addi andi ori xori slli srli srai slti sltiu</code>', '<code>addi t0, t0, 1</code> → t0 = t0 + 1'],
      ['Load', '<code>lw lh lhu lb lbu</code>', '<code>lw t0, 8(s0)</code> → t0 = word at s0 + 8'],
      ['Store', '<code>sw sh sb</code>', '<code>sw t0, 8(s0)</code> → word at s0 + 8 = t0'],
      ['Branch', '<code>beq bne blt bge bltu bgeu</code>', '<code>blt t0, t1, loop</code> → go to loop if t0 &lt; t1'],
      ['Jump', '<code>jal jalr</code>', '<code>jal ra, f</code> → ra = pc + 4, go to f'],
      ['Upper', '<code>lui auipc</code>', '<code>lui t0, 0x12345</code> → t0 = 0x12345000'],
      ['Stop', '<code>ecall ebreak</code>', ''],
    ])}
    <h4>Pseudo-instructions</h4>
    ${table(['You write', 'Assembler emits'], [
      ['<code>li rd, n</code>', '<code>addi</code>, or <code>lui</code> + <code>addi</code> for big values'],
      ['<code>la rd, label</code>', '<code>lui</code> + <code>addi</code> with the label\'s address'],
      ['<code>mv rd, rs</code> / <code>not</code> / <code>neg</code>', '<code>addi rd, rs, 0</code> / <code>xori rd, rs, -1</code> / <code>sub rd, zero, rs</code>'],
      ['<code>j label</code> / <code>call f</code> / <code>ret</code>', '<code>jal zero, label</code> / <code>jal ra, f</code> / <code>jalr zero, 0(ra)</code>'],
      ['<code>bgt ble bgtu bleu</code>', '<code>blt</code> / <code>bge</code> with the operands swapped'],
      ['<code>beqz bnez blez bgez bltz bgtz</code>', 'the branch compared with <code>zero</code>'],
      ['<code>nop</code>, <code>seqz snez sltz sgtz</code>, <code>jr</code>, <code>tail</code>', ''],
    ])}`],
  ['pseudo', 'From pseudocode to assembly', `
    <p>Write the algorithm in pseudocode first, then translate it one line at a time:</p>
    ${steps([
      '<b>Choose a register for each variable</b> and write the mapping in a comment (<code># a0 = sum, t0 = i</code>). Use <code>t</code> registers for scratch values.',
      '<b>Put arrays and fixed values in <code>.data</code></b> with a label, then get their address with <code>la</code>.',
      '<b>Translate each line</b> with the table below. An <code>if</code> becomes a branch on the <i>opposite</i> test that jumps past the body.',
      '<b>Finish with <code>ecall</code></b>, then Assemble, Run, and check Registers and Data memory.',
      '<b>If the answer is wrong</b>, set <b>by Instruction</b> and step <b>Forward</b> while you watch the register you expected to change. Step <b>Back</b> to look at the moment it went wrong.',
    ])}
    ${table(['Pseudocode', 'RV32I'], [
      ['<code>x = 5</code>', '<code>li t0, 5</code>'],
      ['<code>x = y + z</code> &nbsp; / &nbsp; <code>x = y − z</code>', '<code>add t0, t1, t2</code> &nbsp; / &nbsp; <code>sub t0, t1, t2</code>'],
      ['<code>x = y + 3</code>', '<code>addi t0, t1, 3</code>'],
      ['<code>x = y * 8</code> &nbsp; / &nbsp; <code>x = y / 4</code> (y ≥ 0)', '<code>slli t0, t1, 3</code> &nbsp; / &nbsp; <code>srai t0, t1, 2</code>'],
      ['<code>x = A[i]</code> (words)', '<code>slli t3, t1, 2</code><br><code>add t3, s0, t3</code><br><code>lw t0, 0(t3)</code>'],
      ['<code>A[i] = x</code>', 'same address, then <code>sw t0, 0(t3)</code>'],
      ['<code>if a &lt; b: …</code>', '<code>bge a, b, skip</code><br><code>…</code><br><code>skip:</code>'],
      ['<code>while a != b: …</code>', '<code>top: beq a, b, done</code><br><code>…</code><br><code>j top</code><br><code>done:</code>'],
      ['<code>for i = 0 to n−1: …</code>', '<code>li t0, 0</code><br><code>loop: bge t0, n, done</code><br><code>…</code><br><code>addi t0, t0, 1</code><br><code>j loop</code>'],
      ['<code>r = f(x)</code>', '<code>mv a0, x</code><br><code>call f</code><br><code>mv r, a0</code>'],
      ['<code>return v</code>', '<code>mv a0, v</code><br><code>ret</code>'],
    ])}
    <h4>Worked examples</h4>
    ${sample('rv32i', 'max')}
    ${sample('rv32i', 'gcd')}
    ${sample('rv32i', 'array')}
    ${sample('rv32i', 'func')}
    ${sample('rv32i', 'stack')}`],
  ['hazards', 'Hazards and performance', `
    <p>In a perfect pipeline one instruction finishes every cycle (CPI = 1). Three things make it slower or need special hardware:</p>
    ${table(['Hazard', 'When', 'What the hardware does', 'Cost'], [
      ['Data, forwarded', 'An instruction needs a result that is still in MEM or WB', 'The hazard unit sets forwardAE / forwardBE and the ALU input is taken from the later stage', '0 cycles'],
      ['Load-use', 'An instruction uses a register right after <code>lw</code> loads it', 'stallF and stallD hold Fetch and Decode, and flushE puts a bubble into Execute', '1 cycle'],
      ['Control', 'A branch is taken, or any jump', 'The new PC is ready in EX, so flushD and flushE drop the two instructions fetched behind it', '2 cycles'],
    ])}
    <p>To make your code faster, put an unrelated instruction between a <code>lw</code> and the instruction that uses its result,
    and arrange loops so the common case falls through instead of branching. Compare the CPI in the status bar before and after.</p>
    ${sample('rv32i', 'hazards')}`],
  ['errors', 'Fixing mistakes', `
    ${table(['Message or symptom', 'Cause and fix'], [
      ['<code>immediate … does not fit in 12 bits</code>', 'Use <code>li</code> for large constants, or put the value in <code>.data</code> and load it.'],
      ['<code>"…" is not a register</code>', 'Check the spelling: <code>t0</code>–<code>t6</code>, <code>s0</code>–<code>s11</code>, <code>a0</code>–<code>a7</code>, or <code>x0</code>–<code>x31</code>.'],
      ['<code>expected offset(register)</code>', 'Loads and stores are written <code>lw t0, 4(s0)</code>, not <code>lw t0, s0+4</code>.'],
      ['<code>unknown symbol</code>', 'A label is misspelled or missing its <code>:</code>.'],
      ['Halts with <i>illegal</i>', 'The program has no <code>ecall</code> and ran into empty memory, or a jump went to a bad address.'],
      ['Loops forever', 'Check that the loop variable changes and that the branch tests the right way round. Pause with <kbd>R</kbd> and step.'],
      ['Wrong value loaded', 'Word addresses go up by 4: element i is at <code>base + i*4</code>, so shift with <code>slli t, i, 2</code>.'],
      ['A value disappears after <code>call</code>', '<code>t</code> and <code>a</code> registers are not preserved. Keep it in an <code>s</code> register, or save it on the stack.'],
    ])}`],
];

const CONTENT = { sap1: SAP1, rv32i: RV };
const NAMES = { sap1: 'SAP-1', rv32i: 'RISC-V' };

export function createGuide({ getCpu, open: openSample }) {
  const dlg = document.getElementById('guide');
  const nav = dlg.querySelector('.g-nav');
  const body = dlg.querySelector('.g-body');
  const tabs = dlg.querySelector('.g-cpu');
  let cpu = 'sap1', section = 'start';

  function render() {
    const list = CONTENT[cpu];
    if (!list.some(([id]) => id === section)) section = 'start';
    tabs.innerHTML = Object.keys(CONTENT).map((c) =>
      `<button type="button" role="tab" data-cpu="${c}" aria-selected="${c === cpu}">${NAMES[c]}</button>`).join('');
    nav.innerHTML = list.map(([id, title]) =>
      `<button type="button" data-sec="${id}" ${id === section ? 'aria-current="true"' : ''}>${title}</button>`).join('');
    const [, title, html] = list.find(([id]) => id === section);
    body.innerHTML = `<h3>${title}</h3>${html}`;
    body.scrollTop = 0;
  }

  dlg.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (e.target === dlg) { dlg.close(); return; } // click on the backdrop
    if (!t) return;
    if (t.dataset.cpu) { cpu = t.dataset.cpu; render(); }
    else if (t.dataset.sec) { section = t.dataset.sec; render(); }
    else if (t.dataset.open) {
      const [c, id] = t.dataset.open.split(':');
      dlg.close();
      openSample(c, SAMPLES[c][id].source);
    } else if (t.classList.contains('g-close')) dlg.close();
  });

  return {
    show(sec) {
      cpu = getCpu();
      if (sec) section = sec;
      render();
      dlg.showModal();
      body.focus();
    },
  };
}
