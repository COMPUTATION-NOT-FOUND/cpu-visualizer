// SAP-1 testbench: one trace line per T-state, sampled mid-cycle (falling
// edge) so the line shows the control word and bus value that the next rising
// edge will act on, and the register values before that edge.
//   +prog=<hex file, 16 bytes>  +max=<T-state limit, default 10000>  +quiet
// Line: <n> T<t> ctl=<12-bit word> bus=<bus> pc mar ir a b out
// ctl bits, MSB first: Cp Ep LM CE LI EI LA EA SU EU LB LO
module tb_sap1;
  logic clk = 0, clr = 1;
  logic [7:0] out;
  logic halted;
  int max_steps, steps = 0, instrs = 0;
  bit quiet;

  sap1_core dut (.clk, .clr, .out, .halted);
  always #5 clk = ~clk;

  wire [11:0] ctl = {dut.cp, dut.ep, dut.lm, dut.ce, dut.li, dut.ei,
                     dut.la, dut.ea, dut.su, dut.eu, dut.lb, dut.lo};

  initial begin
    if (!$value$plusargs("max=%d", max_steps)) max_steps = 10000;
    quiet = $test$plusargs("quiet");
    repeat (2) @(posedge clk);
    @(negedge clk) clr = 0;
    while (!halted && steps < max_steps) begin
      if (dut.t == 3'd2) instrs++;           // an instruction starts once its fetch completes
      if (!quiet) begin                       // Icarus pads %s ternaries, so print the suffix separately
        $write("%0d T%0d ctl=%03h bus=%02h pc=%h mar=%h ir=%02h a=%02h b=%02h out=%02h",
               steps, dut.t, ctl, dut.bus, dut.pc, dut.mar, dut.ir, dut.a, dut.b, dut.out);
        if (dut.hlt) $display(" hlt"); else $display("");
      end
      steps++;
      @(negedge clk);
    end
    if (halted) $display("halt=hlt tstates=%0d instrs=%0d", steps, instrs);
    else        $display("halt=timeout tstates=%0d instrs=%0d", steps, instrs);
    $display("a=%02h b=%02h out=%02h pc=%h", dut.a, dut.b, dut.out, dut.pc);
    $finish;
  end
endmodule
