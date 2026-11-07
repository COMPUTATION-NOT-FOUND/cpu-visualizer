module riscvsingle(
    input logic clk, reset,
    output logic [31:0] PC,
    input logic [31:0] Instr,
    output logic MemWrite,
  output logic [31:0] ALUResult, WriteData,
    input logic [31:0] ReadData
);
  //Dapath signals
  logic [31:0] InstrD;  
  // Control signals
    logic ALUSrcE, RegWriteW,RegWriteM, Zero,Negative, PCSrcE;
    logic [1:0] ResultSrcW, ResultSrcE, ImmSrcD;
    logic [2:0] ALUControlE;

    // Hazard Unit signals
    logic stallF, stallD, flushD, flushE;
    logic [1:0] forwardAE, forwardBE;
    
    // Register addresses for hazard detection
    logic [4:0]  rs1E, rs2E, rdE, rdM, rdW;

    // Instantiate the controller
    controller c (
        .clk(clk),
      .reset(reset),
      .op(InstrD[6:0]),
      .funct3(InstrD[14:12]),
      .funct7b5(InstrD[30]),
        .Zero(Zero),
      .Negative(Negative),
      .stallD(stallD),
      .flushD(flushD),
        .flushE(flushE),
        .ResultSrcW(ResultSrcW),
        .ResultSrcE(ResultSrcE),
        .MemWriteM(MemWrite),
        .PCSrcE(PCSrcE),
        .ALUSrcE(ALUSrcE),
        .RegWriteW(RegWriteW),
        .ImmSrcD(ImmSrcD),
      .ALUControlE(ALUControlE),
      .RegWriteM(RegWriteM)
    );

    // Instantiate the datapath
    datapath dp (
        .clk(clk),
        .reset(reset),
        .stallF(stallF),
        .stallD(stallD),
        .flushD(flushD),
        .flushE(flushE),
        .ResultSrcW(ResultSrcW),
        .ResultSrcE(ResultSrcE),
        .PCSrcE(PCSrcE),
        .ALUSrcE(ALUSrcE),
        .RegWriteW(RegWriteW),
        .ImmSrcD(ImmSrcD),
        .ALUControlE(ALUControlE),
        .Zero(Zero),
      .Negative(Negative),
        .PCF(PC),
        .InstrF(Instr),
      .ALUResultM_out(ALUResult), // is this needed???
        .WriteDataM(WriteData),
      .ReadDataM(ReadData),
      .ForwardAE(forwardAE),
      .ForwardBE(forwardBE),
      .InstrD_out(InstrD),
      .RS1E(rs1E), .RS2E(rs2E), .RD_E(rdE), .RD_M(rdM), .RD_W(rdW)
    );

    // Instantiate the Hazard Unit
    HazardUnit hazard_unit (
      .clk(clk),
      .reset(reset),
      .rs1D(InstrD[19:15]),
      .rs2D(InstrD[24:20]),
        .rs1E(rs1E),
        .rs2E(rs2E),
        .rdE(rdE),
        .pcsrcE(PCSrcE),
        .resultsrcE(ResultSrcE),
        .rdM(rdM),
      .regwriteM(RegWriteM),
        .rdW(rdW),
      .regwriteW(RegWriteW),
        .stallF(stallF),
        .stallD(stallD),
        .flushD(flushD),
        .flushE(flushE),
        .forwardAE(forwardAE),
        .forwardBE(forwardBE)
    );

endmodule