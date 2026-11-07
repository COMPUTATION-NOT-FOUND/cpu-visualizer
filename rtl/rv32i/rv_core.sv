// RV32I 5-stage pipeline (Fetch, Decode, Execute, Memory, Writeback),
// following the Harris & Harris design: branches resolve in Execute,
// results forward from Memory and Writeback, load-use hazards stall one cycle.
// ecall/ebreak stop the core once every older instruction has finished.
module rv_core
  import rv_pkg::*;
(
  input  logic        clk,
  input  logic        reset,
  // instruction memory
  output logic [31:0] pcF,
  input  logic [31:0] instrF,
  // data memory
  output logic        dmem_we,
  output logic [3:0]  dmem_be,
  output logic [31:0] dmem_addr,
  output logic [31:0] dmem_wd,
  input  logic [31:0] dmem_rd,
  // status
  output logic        halted,
  output logic [1:0]  halt_reason
);
  // ---------------- Fetch ----------------
  logic        stallF, stallD, flushD, flushE, lwstall, stop_fetch, halting;
  logic        pc_srcE;
  logic [31:0] targetE, pcPlus4F;

  assign pcPlus4F = pcF + 32'd4;

  always_ff @(posedge clk)
    if (reset)        pcF <= 32'b0;
    else if (!stallF) pcF <= pc_srcE ? targetE : pcPlus4F;

  // ---------------- F/D register ----------------
  logic [31:0] instrD, pcD;
  logic        validD;

  always_ff @(posedge clk)
    if (reset || flushD) begin
      instrD <= 32'b0; pcD <= 32'b0; validD <= 1'b0;
    end else if (!stallD) begin
      instrD <= instrF; pcD <= pcF; validD <= 1'b1;
    end

  // ---------------- Decode ----------------
  ctrl_t       ctrlD;
  logic [2:0]  imm_srcD;
  logic [4:0]  rs1D, rs2D, rdD;
  logic [31:0] rd1D, rd2D, immD;

  logic        reg_writeW;
  logic [4:0]  rdW;
  logic [31:0] resultW;

  rv_decoder dec (.instr(instrD), .valid(validD), .ctrl(ctrlD), .imm_src(imm_srcD),
                  .rs1(rs1D), .rs2(rs2D), .rd(rdD));
  rv_imm     immgen (.instr(instrD), .sel(imm_srcD), .imm(immD));
  rv_regfile rf (.clk(clk), .reset(reset), .we(reg_writeW), .ra1(rs1D), .ra2(rs2D),
                 .wa(rdW), .wd(resultW), .rd1(rd1D), .rd2(rd2D));

  always_ff @(posedge clk)
    if (reset)                           halting <= 1'b0;
    else if (haltD && !pc_srcE)         halting <= 1'b1;

  // ---------------- D/E register ----------------
  ctrl_t       ctrlE;
  logic [4:0]  rs1E, rs2E, rdE;
  logic [31:0] rd1E, rd2E, immE, pcE;
  logic        validE;

  always_ff @(posedge clk)
    if (reset || flushE) begin
      ctrlE <= '0; rs1E <= 5'b0; rs2E <= 5'b0; rdE <= 5'b0;
      rd1E <= 32'b0; rd2E <= 32'b0; immE <= 32'b0; pcE <= 32'b0; validE <= 1'b0;
    end else begin
      ctrlE <= ctrlD; rs1E <= rs1D; rs2E <= rs2D; rdE <= rdD;
      rd1E <= rd1D; rd2E <= rd2D; immE <= immD; pcE <= pcD; validE <= validD;
    end

  // ---------------- Execute ----------------
  logic [1:0]  forwardAE, forwardBE;
  logic [31:0] fwdAE, fwdBE, srcAE, srcBE, aluE, exResultE;
  logic        takenE;
  logic [31:0] exResultM;

  always_comb begin
    case (forwardAE)
      2'd2:    fwdAE = exResultM;
      2'd1:    fwdAE = resultW;
      default: fwdAE = rd1E;
    endcase
    case (forwardBE)
      2'd2:    fwdBE = exResultM;
      2'd1:    fwdBE = resultW;
      default: fwdBE = rd2E;
    endcase
    case (ctrlE.src_a)
      SRCA_PC:   srcAE = pcE;
      SRCA_ZERO: srcAE = 32'b0;
      default:   srcAE = fwdAE;
    endcase
    srcBE = ctrlE.src_b_imm ? immE : fwdBE;
  end

  rv_alu    alu (.a(srcAE), .b(srcBE), .op(ctrlE.alu_op), .y(aluE));
  rv_branch cmp (.a(fwdAE), .b(fwdBE), .funct3(ctrlE.funct3), .taken(takenE));

  assign pc_srcE   = (ctrlE.branch && takenE) || ctrlE.jump;
  assign targetE   = ctrlE.jalr ? (aluE & ~32'd1) : (pcE + immE);
  assign exResultE = ctrlE.jump ? (pcE + 32'd4) : aluE;

  // ---------------- E/M register ----------------
  ctrl_t       ctrlM;
  logic [4:0]  rdM;
  logic [31:0] writeDataM, pcM;
  logic        validM;

  always_ff @(posedge clk)
    if (reset) begin
      ctrlM <= '0; rdM <= 5'b0; exResultM <= 32'b0; writeDataM <= 32'b0; pcM <= 32'b0; validM <= 1'b0;
    end else begin
      ctrlM <= ctrlE; rdM <= rdE; exResultM <= exResultE; writeDataM <= fwdBE; pcM <= pcE; validM <= validE;
    end

  // ---------------- Memory ----------------
  logic [1:0]  offM;
  logic [31:0] loadM;
  logic [7:0]  byteM;
  logic [15:0] halfM;

  assign offM      = exResultM[1:0];
  assign dmem_addr = exResultM;
  assign dmem_we   = ctrlM.mem_write;

  always_comb begin
    case (ctrlM.funct3[1:0])
      2'b00: begin dmem_be = 4'b0001 << offM;                   dmem_wd = {4{writeDataM[7:0]}};  end
      2'b01: begin dmem_be = offM[1] ? 4'b1100 : 4'b0011;       dmem_wd = {2{writeDataM[15:0]}}; end
      default: begin dmem_be = 4'b1111;                         dmem_wd = writeDataM;            end
    endcase

    byteM = dmem_rd >> {offM, 3'b000};
    halfM = offM[1] ? dmem_rd[31:16] : dmem_rd[15:0];
    case (ctrlM.funct3)
      3'b000:  loadM = {{24{byteM[7]}}, byteM};   // lb
      3'b100:  loadM = {24'b0, byteM};            // lbu
      3'b001:  loadM = {{16{halfM[15]}}, halfM};  // lh
      3'b101:  loadM = {16'b0, halfM};            // lhu
      default: loadM = dmem_rd;                   // lw
    endcase
  end

  // ---------------- M/W register ----------------
  ctrl_t       ctrlW;
  logic [31:0] exResultW, loadW, pcW;
  logic        validW;

  always_ff @(posedge clk)
    if (reset) begin
      ctrlW <= '0; rdW <= 5'b0; exResultW <= 32'b0; loadW <= 32'b0; pcW <= 32'b0; validW <= 1'b0;
    end else begin
      ctrlW <= ctrlM; rdW <= rdM; exResultW <= exResultM; loadW <= loadM; pcW <= pcM; validW <= validM;
    end

  // ---------------- Writeback ----------------
  assign reg_writeW = ctrlW.reg_write;
  assign resultW    = ctrlW.mem_read ? loadW : exResultW;

  always_ff @(posedge clk)
    if (reset) begin
      halted <= 1'b0; halt_reason <= HALT_NONE;
    end else if (validW && ctrlW.halt != HALT_NONE && !halted) begin
      halted <= 1'b1; halt_reason <= ctrlW.halt;
    end

  // ---------------- Hazards ----------------
  // (plain wires: Icarus mis-evaluates struct fields used directly in port lists)
  logic haltD, mem_readE, reg_writeM;
  assign haltD      = ctrlD.halt != HALT_NONE;
  assign mem_readE  = ctrlE.mem_read;
  assign reg_writeM = ctrlM.reg_write;

  rv_hazard hz (
    .rs1D(rs1D), .rs2D(rs2D), .rs1E(rs1E), .rs2E(rs2E), .rdE(rdE),
    .mem_readE(mem_readE), .pc_srcE(pc_srcE),
    .rdM(rdM), .reg_writeM(reg_writeM), .rdW(rdW), .reg_writeW(reg_writeW),
    .haltD(haltD), .halting(halting),
    .forwardAE(forwardAE), .forwardBE(forwardBE), .lwstall(lwstall),
    .stallF(stallF), .stallD(stallD), .flushD(flushD), .flushE(flushE), .stop_fetch(stop_fetch));
endmodule
