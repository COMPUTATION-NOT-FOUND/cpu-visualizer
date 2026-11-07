// Core plus its two memories.
module rv_top (
  input  logic       clk,
  input  logic       reset,
  output logic       halted,
  output logic [1:0] halt_reason
);
  logic [31:0] pc, instr, daddr, dwd, drd;
  logic        dwe;
  logic [3:0]  dbe;

  rv_core core (.clk(clk), .reset(reset), .pcF(pc), .instrF(instr),
                .dmem_we(dwe), .dmem_be(dbe), .dmem_addr(daddr), .dmem_wd(dwd), .dmem_rd(drd),
                .halted(halted), .halt_reason(halt_reason));
  rv_imem imem (.addr(pc), .rd(instr));
  rv_dmem dmem (.clk(clk), .we(dwe), .be(dbe), .addr(daddr), .wd(dwd), .rd(drd));
endmodule
