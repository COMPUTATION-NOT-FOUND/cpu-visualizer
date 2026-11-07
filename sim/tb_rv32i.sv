// Runs a program on rv_top and prints one trace line per cycle.
//   vvp sim.vvp +prog=prog.hex [+data=data.hex] [+max=100000] [+quiet]
// Trace line (all hex, "-" for an empty stage):
//   <cycle> F=<pc> D=<pc> E=<pc> M=<pc> W=<pc> st=<stallF><stallD> fl=<flushD><flushE>
//           fw=<fwdA><fwdB> wb=<rd>:<value> mw=<addr>:<data>:<be>
// The JS pipeline model (web/js/rv32i/pipeline.js) prints the same format.
`timescale 1ns/1ps
module tb_rv32i;
  logic clk = 0, reset = 1;
  logic halted;
  logic [1:0] reason;
  int cycle = 0, retired = 0, max_cycles = 100000;
  bit quiet;

  rv_top dut (.clk(clk), .reset(reset), .halted(halted), .halt_reason(reason));

  always #5 clk = ~clk;

  function automatic string stage(logic v, logic [31:0] pc);
    if (v) return $sformatf("%08h", pc);
    return "--------";
  endfunction

  function automatic string mem_write();
    if (dut.core.dmem_we)
      return $sformatf("%08h:%08h:%h", dut.core.dmem_addr, dut.core.dmem_wd, dut.core.dmem_be);
    return "-";
  endfunction

  function automatic string halt_name();
    if (!halted) return "timeout";
    if (reason == 2'd1) return "ecall";
    return "illegal";
  endfunction

  initial begin
    if (!$value$plusargs("max=%d", max_cycles)) max_cycles = 100000;
    quiet = $test$plusargs("quiet");
    repeat (2) @(posedge clk);
    @(negedge clk) reset = 0;

    @(negedge clk);
    while (!halted && cycle < max_cycles) begin
      if (dut.core.validW && dut.core.ctrlW.halt != 2'd2) retired++;
      if (!quiet)
        $display("%0d F=%08h D=%s E=%s M=%s W=%s st=%0d%0d fl=%0d%0d fw=%0d%0d wb=%0d:%08h mw=%s",
          cycle, dut.core.pcF,
          stage(dut.core.validD, dut.core.pcD), stage(dut.core.validE, dut.core.pcE),
          stage(dut.core.validM, dut.core.pcM), stage(dut.core.validW, dut.core.pcW),
          dut.core.stallF, dut.core.stallD, dut.core.flushD, dut.core.flushE,
          dut.core.forwardAE, dut.core.forwardBE,
          (dut.core.reg_writeW && dut.core.rdW != 0) ? dut.core.rdW : 5'd0,
          (dut.core.reg_writeW && dut.core.rdW != 0) ? dut.core.resultW : 32'd0,
          mem_write());
      cycle++;
      @(negedge clk);
    end

    $display("halt=%s cycles=%0d retired=%0d",
      halt_name(), cycle, retired);
    for (int i = 1; i < 32; i++)
      if (dut.core.rf.regs[i] != 0) $display("x%0d=%08h", i, dut.core.rf.regs[i]);
    for (int i = 0; i < 1024; i++)
      if (dut.dmem.mem[i] != 0) $display("m[%08h]=%08h", i * 4, dut.dmem.mem[i]);
    $finish;
  end
endmodule
