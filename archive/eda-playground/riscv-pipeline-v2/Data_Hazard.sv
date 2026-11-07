module HazardUnit (
  	input logic clk,
  	input logic reset,
    input logic [4:0] rs1D,
    input logic [4:0] rs2D,

    input logic [4:0] rs1E,
    input logic [4:0] rs2E,
    input logic [4:0] rdE,
    input logic pcsrcE,
    input logic [1:0] resultsrcE,

    input logic [4:0] rdM,
    input logic regwriteM,

    input logic [4:0] rdW,
    input logic regwriteW,

    output logic stallF,

    output logic stallD,
    output logic flushD,

    output logic flushE,
    output logic [1:0] forwardAE,
    output logic [1:0] forwardBE
);
  logic lwstall;

  // Forwarding
  // forwardAE
  // 00: No forwarding
  // 01: Forward from Writeback
  // 10: Forward from Memory
  assign forwardAE = ((rs1E === 5'bx) || (rdM === 5'bx) || (rs1E === 5'bx) || (rdW === 5'bx)) ? 2'b00 : 
                      (rs1E == rdM && regwriteM) && (rs1E != 0) ? 2'b10 : 
                      (rs1E == rdW && regwriteW) && (rs1E != 0) ? 2'b01 : 2'b00;

  // forwardBE
  // 00: No forwarding
  // 01: Forward from Writeback
  // 10: Forward from Memory
  assign forwardBE = ((rs2E === 5'bx) || (rdM === 5'bx) || (rs2E === 5'bx) || (rdW === 5'bx)) ? 2'b00 : 
    (rs2E == rdM && regwriteM) && (rs2E != 0) ? 2'b10 : 
    (rs2E == rdW && regwriteW) && (rs2E != 0) ? 2'b01 : 2'b00;

  // StallD
  // Make a temp variable lwstall
  assign lwstall = ((rs1D === 5'bx) || (rs2D === 5'bx) || (rdE === 5'bx) || resultsrcE[0] === 1'bx ) ? 0 :
    resultsrcE[0] & ((rs1D == rdE) | (rs2D == rdE)) & (rdE != 0);
  // if the instruction in the decode stage is a load instruction and the source register
  // of the load instruction is equal to the destination register of the instruction in 
  // the execute stage, then stall the decode stage
  assign stallF = lwstall;
  assign stallD = lwstall;
  
 logic lwstall_delayed;
logic pcsrcE_delayed;

// always @(posedge clk) begin
//   if (reset) begin
//     lwstall_delayed <= 0;
//     pcsrcE_delayed <= 0;
//   end else begin
//     lwstall_delayed <= lwstall; 
//     pcsrcE_delayed <= pcsrcE;
//   end
// end

 
  
  
  
//   // flushD
//   // pcsrcE is the signal that tells us if we need to flush the decode stage, i.e branching. 
  assign flushD = pcsrcE;

  /*
    The execute stage is comprised of combinational logic and that must also be flushed when lwstall is high
  */
  assign flushE = pcsrcE || lwstall;
  
  
  endmodule