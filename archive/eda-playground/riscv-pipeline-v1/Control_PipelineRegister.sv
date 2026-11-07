

module PipelineControlRegisters (
    input logic clk,resetin, flushDin, stallD, flushEin,

    // Inputs
    input logic regwriteD, memwriteD, jumpD, branchD, alusrcD,
    input logic [1:0] resultsrcD,
    input logic [2:0] alucontrolD,
    input logic [2:0] funct3D,

    // Outputs
    output logic memwriteE_out, jumpE, branchE, alusrcE,
  	output logic [1:0] resultsrcE_out,
    output logic [2:0] alucontrolE_out,
    output logic [2:0] funct3E_out,
    output logic memwriteM_out,
    output logic [1:0] resultsrcM_out,
    output logic regwriteW_out,
  output logic [1:0] resultsrcW,
  output logic regwriteM_out
);

    logic regwriteE_out;
    
  logic flushD, flushE, reset;
  assign flushD= flushDin;
  assign flushE=flushEin;
  assign reset=resetin;
  

    // Decode -> Execute Pipeline Registers
  flopenr #(1) regwriteD_reg (.clk(clk), .reset(reset||flushD), .en(~stallD), .d(regwriteD), .q(regwriteE_out));
  flopenr #(1) memwriteD_reg (.clk(clk), .reset(reset||flushD), .en(~stallD), .d(memwriteD), .q(memwriteE_out));
  flopenr #(1) jumpD_reg (.clk(clk), .reset(reset||flushD), .en(~stallD), .d(jumpD), .q(jumpE));
  flopenr #(1) branchD_reg (.clk(clk), .reset(reset||flushD), .en(~stallD), .d(branchD), .q(branchE));
  flopenr #(1) alusrcD_reg (.clk(clk), .reset(reset||flushD), .en(~stallD), .d(alusrcD), .q(alusrcE));
  flopenr #(2) resultsrcD_reg (.clk(clk), .reset(reset||flushD), .en(~stallD), .d(resultsrcD), .q(resultsrcE_out));
  flopenr #(3) alucontrolD_reg (.clk(clk), .reset(reset||flushD), .en(~stallD), .d(alucontrolD), .q(alucontrolE_out));
  flopenr #(3) funct3D_reg (.clk(clk), .reset(reset||flushD), .en(~stallD), .d(funct3D), .q(funct3E_out));

    // Execute -> Memory Pipeline Registers
  flopr #(1) regwriteE_reg (.clk(clk), .reset(reset), .d(regwriteE_out), .q(regwriteM_out));
  flopr #(1) memwriteE_reg (.clk(clk), .reset(reset||flushE), .d(memwriteE_out), .q(memwriteM_out));
  flopr #(2) resultsrcE_reg (.clk(clk), .reset(reset), .d(resultsrcE_out), .q(resultsrcM_out));

    // Memory -> Writeback Pipeline Registers
  flopr #(1) regwriteM_reg (.clk(clk), .reset(reset), .d(regwriteM_out), .q(regwriteW_out));
  flopr #(2) resultsrcM_reg (.clk(clk), .reset(reset), .d(resultsrcM_out), .q(resultsrcW));

endmodule
