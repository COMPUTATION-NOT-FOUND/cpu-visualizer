

module datapath(
    input logic clk, reset, stallF, stallD, flushD, flushE,
  input logic [1:0] ResultSrcW,ResultSrcE,
    input logic PCSrcE, ALUSrcE, RegWriteW,
    input logic [1:0] ImmSrcD,
  input logic [2:0] ALUControlE,
    output logic Zero,Negative,
    output logic [31:0] PCF,
  input logic [31:0] InstrF,
  output logic [31:0] ALUResultM_out, WriteDataM,
  input logic [31:0] ReadDataM,
  input logic [1:0] ForwardAE,ForwardBE,
  output logic [31:0] InstrD_out,
  output logic [4:0] RS1E,RS2E,RD_E,RD_M,RD_W
);

    
  
    logic [31:0] PCNext, PCPlus4F, PCTargetE;
    logic [31:0] temp1, temp2;
    logic [31:0] ImmExtD, ImmExtE;
    logic [31:0] SrcA, SrcB;
    logic [31:0] ResultW;
    
    // Pipeline Register Outputs
logic [31:0]  RD1E, RD2E, PCE, ImmExtE_out, PCPlus4E_out;   
logic [31:0]  WriteDataM_out, PCPlus4M_out; //ALUResultM_out,
logic [31:0] ALUResultW_out, ReadDataW, PCPlus4W;
    
  
  	//intermediate results;
  logic [31:0] RD1D,RD2D,ALUResultE;
 logic RegWriteW_defined;
 assign RegWriteW_defined = (RegWriteW === 1'bx) ? 1'b0 : RegWriteW;

    
    // Instantiate Pipeline Registers
    PipelineDataRegisters PDR (
      .clk(clk),.resetin(reset), .flushDin(flushD), .stallD(stallD), .flushEin(flushE),
      .instrF(InstrF), .pcplus4F(PCPlus4F), .pcF(PCF),
        .rd1D(RD1D), .rd2D(RD2D),  .immextD(ImmExtD), .pcplus4D(PCPlus4F),
      .aluresE(ALUResultE), .writedataE(WriteDataM), .pcplus4E(PCPlus4E_out),
        .readdataM(ReadDataM),
        .instrD_out(InstrD_out),
      .rs1D(InstrD_out[19:15]), .rs2D(InstrD_out[24:20]), .rdD(InstrD_out[11:7]),
        .rd1E_out(RD1E), .rd2E_out(RD2E), .pcE_out(PCE), .immextE_out(ImmExtE_out), .pcplus4E_out(PCPlus4E_out),
      .rs1E_out(RS1E), .rs2E_out(RS2E),.rdE_out(RD_E),
        .aluresM_out(ALUResultM_out), .writedataM_out(WriteDataM_out),
        .rdM_out(RD_M),
        .aluresW_out(ALUResultW_out), .readdataW_out(ReadDataW), .pcplus4W_out(PCPlus4W),
        .rdW_out(RD_W)

    );

    // Next PC logic
  flopenr #(32) pcreg(clk, reset, ~stallF, PCNext, PCF);
    adder pcadd4(PCF, 32'd4, PCPlus4F);
  adder pcaddbranch(PCE, ImmExtE_out, temp1);//update to PCE later

    // Register file logic
  regfile rf(~clk, RegWriteW_defined, InstrD_out[19:15], InstrD_out[24:20], RD_W, ResultW, RD1D, RD2D);
    extend ext(InstrD_out[31:7], ImmSrcD, ImmExtD);

    // ALU logic
    mux3 #(32) ForwardALogic(RD1E, ResultW, ALUResultM_out, ForwardAE, SrcA);
    mux3 #(32) ForwardBLogic(RD2E, ResultW, ALUResultM_out, ForwardBE, temp2);
    mux2 #(32) srcbmux(temp2, ImmExtE_out, ALUSrcE, SrcB);
  alu alu(SrcA, SrcB, ALUControlE, ALUResultE, Zero,Negative);
  mux3 #(32) resultmux(ALUResultW_out, ReadDataW, PCPlus4W, ResultSrcW, ResultW);

    // Next PC logic
    always @(*) begin
        if (ResultSrcE == 2'b10 && ALUSrcE == 1'b1)
            PCTargetE = ALUResultE;
        else
            PCTargetE = temp1;
    end

  mux2 #(32) pcmux( PCPlus4F, PCTargetE, PCSrcE, PCNext);

endmodule
