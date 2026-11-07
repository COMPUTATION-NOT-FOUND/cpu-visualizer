// Small datapath blocks: immediate generator, ALU, branch comparator, register file.

module rv_imm
  import rv_pkg::*;
(
  input  logic [31:0] instr,
  input  logic [2:0]  sel,
  output logic [31:0] imm
);
  always_comb
    case (sel)
      IMM_S:   imm = {{20{instr[31]}}, instr[31:25], instr[11:7]};
      IMM_B:   imm = {{20{instr[31]}}, instr[7], instr[30:25], instr[11:8], 1'b0};
      IMM_U:   imm = {instr[31:12], 12'b0};
      IMM_J:   imm = {{12{instr[31]}}, instr[19:12], instr[20], instr[30:21], 1'b0};
      default: imm = {{20{instr[31]}}, instr[31:20]};
    endcase
endmodule

module rv_alu
  import rv_pkg::*;
(
  input  logic [31:0] a,
  input  logic [31:0] b,
  input  logic [3:0]  op,
  output logic [31:0] y
);
  always_comb
    case (op)
      ALU_SUB:  y = a - b;
      ALU_AND:  y = a & b;
      ALU_OR:   y = a | b;
      ALU_XOR:  y = a ^ b;
      ALU_SLL:  y = a << b[4:0];
      ALU_SRL:  y = a >> b[4:0];
      ALU_SRA:  y = $signed(a) >>> b[4:0];
      ALU_SLT:  y = {31'b0, $signed(a) < $signed(b)};
      ALU_SLTU: y = {31'b0, a < b};
      default:  y = a + b;
    endcase
endmodule

// Branch comparator. Works on the forwarded operands in Execute.
module rv_branch (
  input  logic [31:0] a,
  input  logic [31:0] b,
  input  logic [2:0]  funct3,
  output logic        taken
);
  always_comb
    case (funct3)
      3'b000:  taken = (a == b);                    // beq
      3'b001:  taken = (a != b);                    // bne
      3'b100:  taken = ($signed(a) <  $signed(b));  // blt
      3'b101:  taken = ($signed(a) >= $signed(b));  // bge
      3'b110:  taken = (a <  b);                    // bltu
      3'b111:  taken = (a >= b);                    // bgeu
      default: taken = 1'b0;
    endcase
endmodule

// 32 x 32 register file. Writes on the rising edge; reading the register that
// is being written returns the new value (same effect as a falling-edge write).
module rv_regfile (
  input  logic        clk,
  input  logic        reset,
  input  logic        we,
  input  logic [4:0]  ra1,
  input  logic [4:0]  ra2,
  input  logic [4:0]  wa,
  input  logic [31:0] wd,
  output logic [31:0] rd1,
  output logic [31:0] rd2
);
  logic [31:0] regs [0:31];

  always_ff @(posedge clk)
    if (reset) begin
      for (int i = 0; i < 32; i++) regs[i] <= 32'b0;
    end else if (we && wa != 5'd0) regs[wa] <= wd;

  assign rd1 = (ra1 == 5'd0) ? 32'b0 : (we && wa == ra1) ? wd : regs[ra1];
  assign rd2 = (ra2 == 5'd0) ? 32'b0 : (we && wa == ra2) ? wd : regs[ra2];
endmodule
