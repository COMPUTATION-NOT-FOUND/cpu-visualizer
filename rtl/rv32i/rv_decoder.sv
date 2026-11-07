// Decode-stage control: instruction -> control signals.
// Bubbles (valid = 0) decode to all-zero controls. Register fields that an
// instruction does not use are reported as x0, so they never stall or forward.
module rv_decoder
  import rv_pkg::*;
(
  input  logic [31:0] instr,
  input  logic        valid,
  output ctrl_t       ctrl,
  output logic [2:0]  imm_src,
  output logic [4:0]  rs1,
  output logic [4:0]  rs2,
  output logic [4:0]  rd
);
  logic [6:0] op, f7;
  logic [2:0] f3;
  logic use_rs1, use_rs2;
  ctrl_t c;

  assign op = instr[6:0];
  assign f3 = instr[14:12];
  assign f7 = instr[31:25];

  always_comb begin
    c       = '0;
    imm_src = IMM_I;
    use_rs1 = 1'b0;
    use_rs2 = 1'b0;

    case (op)
      7'b0110111: begin // lui
        c.reg_write = 1; c.src_a = SRCA_ZERO; c.src_b_imm = 1; imm_src = IMM_U;
      end
      7'b0010111: begin // auipc
        c.reg_write = 1; c.src_a = SRCA_PC; c.src_b_imm = 1; imm_src = IMM_U;
      end
      7'b1101111: begin // jal
        c.reg_write = 1; c.jump = 1; imm_src = IMM_J;
      end
      7'b1100111: // jalr
        if (f3 == 3'b000) begin
          c.reg_write = 1; c.jump = 1; c.jalr = 1; c.src_b_imm = 1; use_rs1 = 1;
        end else c.halt = HALT_ILLEGAL;
      7'b1100011: // branches
        if (f3 != 3'b010 && f3 != 3'b011) begin
          c.branch = 1; c.funct3 = f3; imm_src = IMM_B; use_rs1 = 1; use_rs2 = 1;
        end else c.halt = HALT_ILLEGAL;
      7'b0000011: // loads
        if (f3 == 3'b000 || f3 == 3'b001 || f3 == 3'b010 || f3 == 3'b100 || f3 == 3'b101) begin
          c.reg_write = 1; c.mem_read = 1; c.src_b_imm = 1; c.funct3 = f3; use_rs1 = 1;
        end else c.halt = HALT_ILLEGAL;
      7'b0100011: // stores
        if (f3 == 3'b000 || f3 == 3'b001 || f3 == 3'b010) begin
          c.mem_write = 1; c.src_b_imm = 1; c.funct3 = f3; imm_src = IMM_S; use_rs1 = 1; use_rs2 = 1;
        end else c.halt = HALT_ILLEGAL;
      7'b0010011: begin // ALU with immediate
        c.reg_write = 1; c.src_b_imm = 1; use_rs1 = 1;
        case (f3)
          3'b000: c.alu_op = ALU_ADD;
          3'b010: c.alu_op = ALU_SLT;
          3'b011: c.alu_op = ALU_SLTU;
          3'b100: c.alu_op = ALU_XOR;
          3'b110: c.alu_op = ALU_OR;
          3'b111: c.alu_op = ALU_AND;
          3'b001: if (f7 == 7'b0000000) c.alu_op = ALU_SLL; else c.halt = HALT_ILLEGAL;
          default: // 3'b101
            if (f7 == 7'b0000000) c.alu_op = ALU_SRL;
            else if (f7 == 7'b0100000) c.alu_op = ALU_SRA;
            else c.halt = HALT_ILLEGAL;
        endcase
      end
      7'b0110011: begin // ALU register-register
        c.reg_write = 1; use_rs1 = 1; use_rs2 = 1;
        case ({f7, f3})
          {7'b0000000, 3'b000}: c.alu_op = ALU_ADD;
          {7'b0100000, 3'b000}: c.alu_op = ALU_SUB;
          {7'b0000000, 3'b001}: c.alu_op = ALU_SLL;
          {7'b0000000, 3'b010}: c.alu_op = ALU_SLT;
          {7'b0000000, 3'b011}: c.alu_op = ALU_SLTU;
          {7'b0000000, 3'b100}: c.alu_op = ALU_XOR;
          {7'b0000000, 3'b101}: c.alu_op = ALU_SRL;
          {7'b0100000, 3'b101}: c.alu_op = ALU_SRA;
          {7'b0000000, 3'b110}: c.alu_op = ALU_OR;
          {7'b0000000, 3'b111}: c.alu_op = ALU_AND;
          default: c.halt = HALT_ILLEGAL;
        endcase
      end
      7'b0001111: // fence: nothing to order in this core
        if (f3 != 3'b000) c.halt = HALT_ILLEGAL;
      7'b1110011: // ecall / ebreak end the program
        c.halt = (instr == 32'h00000073 || instr == 32'h00100073) ? HALT_ECALL : HALT_ILLEGAL;
      default: c.halt = HALT_ILLEGAL;
    endcase

    // An illegal instruction does nothing except halt.
    if (c.halt == HALT_ILLEGAL) begin
      c = '0; c.halt = HALT_ILLEGAL; use_rs1 = 0; use_rs2 = 0;
    end
    if (!valid) begin
      c = '0; use_rs1 = 0; use_rs2 = 0;
    end
  end

  assign ctrl = c;
  assign rs1 = use_rs1 ? instr[19:15] : 5'd0;
  assign rs2 = use_rs2 ? instr[24:20] : 5'd0;
  assign rd  = c.reg_write ? instr[11:7] : 5'd0;
endmodule
