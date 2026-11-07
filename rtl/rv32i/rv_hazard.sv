// Hazard unit: forwarding, load-use stall, flushes and halt.
module rv_hazard (
  input  logic [4:0] rs1D, rs2D,
  input  logic [4:0] rs1E, rs2E, rdE,
  input  logic       mem_readE,
  input  logic       pc_srcE,
  input  logic [4:0] rdM,
  input  logic       reg_writeM,
  input  logic [4:0] rdW,
  input  logic       reg_writeW,
  input  logic       haltD,      // ecall/ebreak/illegal instruction in Decode
  input  logic       halting,    // a halt was already accepted
  output logic [1:0] forwardAE,  // 0: register file, 1: from Writeback, 2: from Memory
  output logic [1:0] forwardBE,
  output logic       lwstall,
  output logic       stallF, stallD, flushD, flushE,
  output logic       stop_fetch
);
  assign forwardAE = (rs1E != 5'd0 && reg_writeM && rs1E == rdM) ? 2'd2 :
                     (rs1E != 5'd0 && reg_writeW && rs1E == rdW) ? 2'd1 : 2'd0;
  assign forwardBE = (rs2E != 5'd0 && reg_writeM && rs2E == rdM) ? 2'd2 :
                     (rs2E != 5'd0 && reg_writeW && rs2E == rdW) ? 2'd1 : 2'd0;

  // A load in Execute whose result is needed by the instruction in Decode.
  assign lwstall = mem_readE && rdE != 5'd0 && (rs1D == rdE || rs2D == rdE);

  // Once a halt is in Decode on the correct path, stop fetching new work.
  assign stop_fetch = (haltD && !pc_srcE) || halting;

  assign stallF = lwstall || stop_fetch;
  assign stallD = lwstall;
  assign flushD = pc_srcE || stop_fetch;
  assign flushE = pc_srcE || lwstall;
endmodule
