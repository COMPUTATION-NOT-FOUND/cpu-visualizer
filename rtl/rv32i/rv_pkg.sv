// Shared types for the RV32I 5-stage pipeline.
package rv_pkg;

  // ALU operations
  localparam logic [3:0] ALU_ADD = 4'd0, ALU_SUB = 4'd1, ALU_AND = 4'd2, ALU_OR = 4'd3,
                         ALU_XOR = 4'd4, ALU_SLL = 4'd5, ALU_SRL = 4'd6, ALU_SRA = 4'd7,
                         ALU_SLT = 4'd8, ALU_SLTU = 4'd9;

  // Immediate formats
  localparam logic [2:0] IMM_I = 3'd0, IMM_S = 3'd1, IMM_B = 3'd2, IMM_U = 3'd3, IMM_J = 3'd4;

  // ALU source A
  localparam logic [1:0] SRCA_RS1 = 2'd0, SRCA_PC = 2'd1, SRCA_ZERO = 2'd2;

  // Halt reasons
  localparam logic [1:0] HALT_NONE = 2'd0, HALT_ECALL = 2'd1, HALT_ILLEGAL = 2'd2;

  // Control signals produced in Decode and carried down the pipeline.
  // An all-zero value is a bubble.
  typedef struct packed {
    logic       reg_write;
    logic       mem_write;
    logic       mem_read;   // load: the result comes from memory
    logic       jump;       // jal or jalr
    logic       jalr;
    logic       branch;
    logic [1:0] src_a;
    logic       src_b_imm;
    logic [3:0] alu_op;
    logic [2:0] funct3;     // branch condition / load-store size
    logic [1:0] halt;
  } ctrl_t;

endpackage
