// SAP-1 (Simple As Possible, Malvino): 4-bit PC and MAR, 16 x 8 RAM, 8-bit
// IR, A, B and output registers, an adder/subtractor, and one 8-bit W bus.
// Instruction format: opcode in IR[7:4], address in IR[3:0].
module sap1_ram (
  input  logic [3:0] addr,
  output logic [7:0] data
);
  logic [7:0] mem [0:15];
  initial begin
    string f;
    for (int i = 0; i < 16; i++) mem[i] = 8'h00;
    if ($value$plusargs("prog=%s", f)) $readmemh(f, mem);
  end
  assign data = mem[addr];
endmodule

module sap1_core (
  input  logic       clk,
  input  logic       clr,
  output logic [7:0] out,
  output logic       halted
);
  logic [3:0] pc, mar;
  logic [7:0] ir, a, b, bus, ram_data, alu;
  logic [2:0] t;
  logic ep, ce, ei, ea, eu, cp, lm, li, la, lb, lo, su, hlt;

  sap1_ctrl ctrl (
    .clk, .clr, .opcode(ir[7:4]), .t, .halted,
    .ep, .ce, .ei, .ea, .eu, .cp, .lm, .li, .la, .lb, .lo, .su, .hlt
  );

  sap1_ram ram (.addr(mar), .data(ram_data));

  assign alu = su ? a - b : a + b;

  // Exactly one driver per T-state; an idle bus reads as 0.
  always_comb begin
    bus = 8'h00;
    if (ep) bus = {4'h0, pc};
    if (ce) bus = ram_data;
    if (ei) bus = {4'h0, ir[3:0]};
    if (ea) bus = a;
    if (eu) bus = alu;
  end

  always_ff @(posedge clk) begin
    if (clr) begin
      pc <= '0; mar <= '0; ir <= '0; a <= '0; b <= '0; out <= '0;
    end else begin
      if (cp) pc  <= pc + 4'd1;
      if (lm) mar <= bus[3:0];
      if (li) ir  <= bus;
      if (la) a   <= bus;
      if (lb) b   <= bus;
      if (lo) out <= bus;
    end
  end
endmodule
