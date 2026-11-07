

module PipelineDataRegisters (
    input logic clk,resetin, flushDin, stallD, flushEin,

    // Inputs
    input logic [31:0] instrF, pcplus4F, pcF, // Fetch -> Decode
    input logic [31:0] rd1D, rd2D, immextD, pcplus4D, // Decode -> Execute
    input logic [4:0] rs1D, rs2D, rdD,
    input logic [31:0] aluresE, writedataE, pcplus4E, // Execute -> Memory
    input logic [31:0] readdataM, // Memory -> Writeback

    // Outputs
    output logic [31:0] instrD_out, // Fetch -> Decode
    output logic [31:0] rd1E_out, rd2E_out, pcE_out, immextE_out, pcplus4E_out, // Decode -> Execute
  output logic [4:0] rs1E_out, rs2E_out,rdE_out, 
    output logic [31:0] aluresM_out, writedataM_out, // Execute -> Memory
    output logic [4:0] rdM_out,
    output logic [31:0] aluresW_out, readdataW_out, pcplus4W_out, // Memory -> Writeback
    output logic [4:0] rdW_out
);

// Intermediate registers
  logic [31:0] pcplus4D_out, pcD_out, pcplus4M_out;
  logic [31:0] instrE_out,instrM_out,instrW_out;
  logic flushD, flushE, reset;
  assign flushD= flushDin;
  assign flushE=flushEin;
  assign reset=resetin;

// Fetch -> Decode Pipeline Registers
  flopenr #(32) instrD_reg (.clk(clk), .reset(reset||flushD), .en(~stallD), .d(instrF), .q(instrD_out));
  flopenr #(32) pcplus4D_reg (.clk(clk), .reset(reset||flushD), .en(~stallD), .d(pcplus4F), .q(pcplus4D_out));
  flopenr #(32) pcD_reg (.clk(clk), .reset(reset||flushD), .en(~stallD), .d(pcF), .q(pcD_out));

// Decode -> Execute Pipeline Registers
  flopr #(32) instrE_reg (.clk(clk), .reset(reset),.d(instrD_out), .q(instrE_out));
  flopr #(32) rd1E_reg (.clk(clk), .reset(reset), .d(rd1D), .q(rd1E_out));
  flopr #(32) rd2E_reg (.clk(clk), .reset(reset), .d(rd2D), .q(rd2E_out));
  flopr #(32) pcE_reg (.clk(clk), .reset(reset), .d(pcD_out), .q(pcE_out));
  flopr #(32) immextE_reg (.clk(clk), .reset(reset), .d(immextD), .q(immextE_out));
  flopr #(32) pcplus4E_reg (.clk(clk), .reset(reset||flushE), .d(pcplus4D_out), .q(pcplus4E_out));
  flopr #(5) rs1E_reg (.clk(clk), .reset(reset||flushE), .d(rs1D), .q(rs1E_out));
  flopr #(5) rs2E_reg (.clk(clk), .reset(reset||flushE), .d(rs2D), .q(rs2E_out));
  flopr #(5) rdE_reg (.clk(clk), .reset(reset), .d(rdD), .q(rdE_out));

// Execute -> Memory Pipeline Registers
  flopr #(32) instrM_reg (.clk(clk), .reset(reset),.d(instrE_out), .q(instrM_out));
  flopr #(32) aluresM_reg (.clk(clk), .reset(reset), .d(aluresE), .q(aluresM_out));
  flopr #(32) writedataM_reg (.clk(clk), .reset(reset), .d(writedataE), .q(writedataM_out));
  flopr #(32) pcplus4M_reg (.clk(clk), .reset(reset), .d(pcplus4E_out), .q(pcplus4M_out));
  flopr #(5) rdM_reg (.clk(clk), .reset(reset), .d(rdE_out), .q(rdM_out));

// Memory -> Writeback Pipeline Registers
  flopr #(32) instrW_reg (.clk(clk), .reset(reset),.d(instrM_out), .q(instrW_out));
  flopr #(32) aluresW_reg (.clk(clk), .reset(reset), .d(aluresM_out), .q(aluresW_out));
  flopr #(32) readdataW_reg (.clk(clk), .reset(reset), .d(readdataM), .q(readdataW_out));
  flopr #(32) pcplus4W_reg (.clk(clk), .reset(reset), .d(pcplus4M_out), .q(pcplus4W_out));
  flopr #(5) rdW_reg (.clk(clk), .reset(reset), .d(rdM_out), .q(rdW_out));

endmodule
