// SAP-1 controller-sequencer: a six-state ring counter (T0..T5) and the
// control word decoded from the current state and the opcode in IR.
//
//   T0  Ep LM        PC -> bus -> MAR
//   T1  Cp           PC + 1
//   T2  CE LI        RAM[MAR] -> bus -> IR
//   T3  LDA/ADD/SUB: EI LM   (IR operand -> MAR)    OUT: EA LO    HLT: halt
//   T4  LDA: CE LA           ADD/SUB: CE LB
//   T5  ADD: EU LA           SUB: SU EU LA
//
// Malvino's original drives the controller from the falling clock edge; here
// the ring counter and every register share the rising edge, and the control
// word is combinational, which gives the same register-transfer sequence.
module sap1_ctrl (
  input  logic       clk,
  input  logic       clr,
  input  logic [3:0] opcode,
  output logic [2:0] t,        // current T-state, 0..5
  output logic       halted,
  // bus drivers
  output logic       ep, ce, ei, ea, eu,
  // loads and other controls
  output logic       cp, lm, li, la, lb, lo, su, hlt
);
  localparam logic [3:0] LDA = 4'h0, ADD = 4'h1, SUB = 4'h2, OUT = 4'he, HLT = 4'hf;

  always_ff @(posedge clk) begin
    if (clr) begin
      t      <= 3'd0;
      halted <= 1'b0;
    end else if (!halted) begin
      if (hlt) halted <= 1'b1;
      t <= (t == 3'd5) ? 3'd0 : t + 3'd1;
    end
  end

  always_comb begin
    {ep, ce, ei, ea, eu, cp, lm, li, la, lb, lo, su, hlt} = '0;
    if (!halted) begin
      case (t)
        3'd0: begin ep = 1; lm = 1; end
        3'd1: cp = 1;
        3'd2: begin ce = 1; li = 1; end
        3'd3: case (opcode)
          LDA, ADD, SUB: begin ei = 1; lm = 1; end
          OUT:           begin ea = 1; lo = 1; end
          HLT:           hlt = 1;
          default: ;
        endcase
        3'd4: case (opcode)
          LDA:      begin ce = 1; la = 1; end
          ADD, SUB: begin ce = 1; lb = 1; end
          default: ;
        endcase
        3'd5: case (opcode)
          ADD: begin eu = 1; la = 1; end
          SUB: begin eu = 1; su = 1; la = 1; end
          default: ;
        endcase
        default: ;
      endcase
    end
  end
endmodule
