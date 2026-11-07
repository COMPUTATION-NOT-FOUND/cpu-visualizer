
module controller(
    input logic clk,
  	input logic reset,
    input logic [6:0] op,
    input logic [2:0] funct3,
    input logic funct7b5,
    input logic Zero,Negative,
  	input logic flushD,
  	input logic stallD,
    input logic flushE, // Ensure flushE is properly handled

  output logic [1:0] ResultSrcW,ResultSrcE,
    output logic MemWriteM,
    output logic PCSrcE,
    output logic ALUSrcE,
    output logic RegWriteW,
    output logic [1:0] ImmSrcD,
  output logic [2:0] ALUControlE,
  output logic RegWriteM
);

    logic [1:0] ALUOp;
    logic Branch;
  
    // Intermediate signals
    logic RegWriteD, MemWriteD, JumpD, ALUSrcD;
    logic [1:0] ResultSrcD;
    logic [2:0] ALUControlD;

    logic memwriteE, jumpE, branchE;
    logic [2:0] funct3E;
    logic memwriteM;
    logic [1:0] resultsrcM;
    logic regwriteW;

    // Instantiate Main Decoder
    maindec md(
        .op(op),
        .ResultSrc(ResultSrcD),
        .MemWrite(MemWriteD),
        .Branch(Branch),
        .ALUSrc(ALUSrcD),
        .RegWrite(RegWriteD),
        .Jump(JumpD),
        .ImmSrc(ImmSrcD),
        .ALUOp(ALUOp)
    );

    // Instantiate ALU Decoder
    aludec ad(
        .opb5(op[5]),
        .funct3(funct3),
        .funct7b5(funct7b5),
        .ALUOp(ALUOp),
        .ALUControl(ALUControlD)
    );

    // Instantiate Pipeline Control Registers
    PipelineControlRegisters PCR (
        .clk(clk),
      .resetin(reset), 
      .flushDin(flushD),
              .stallD(stallD),
        .flushEin(flushE),

        // Inputs
        .regwriteD(RegWriteD),
        .memwriteD(MemWriteD),
        .jumpD(JumpD),
        .branchD(Branch),
        .alusrcD(ALUSrcD),
        .resultsrcD(ResultSrcD),
        .alucontrolD(ALUControlD),
        .funct3D(funct3),

        // Outputs
        .memwriteE_out(memwriteE),
        .jumpE(jumpE),
        .branchE(branchE),
        .alusrcE(ALUSrcE),
      	.resultsrcE_out(ResultSrcE),  	

        .alucontrolE_out(ALUControlE),
        .funct3E_out(funct3E),
        .memwriteM_out(MemWriteM),
        .resultsrcM_out(resultsrcM),
        .regwriteW_out(RegWriteW),
      .resultsrcW(ResultSrcW),
      .regwriteM_out(RegWriteM)
    );
  
  assign PCSrcE = (branchE === 1'bx || Zero === 1'bx || funct3E === 1'bx ||jumpE === 1'bx ||  Negative === 1'bx ) 
  ? 1'b0 
    : (branchE & ((Zero|Negative) ^ funct3E[0])| jumpE );



endmodule
