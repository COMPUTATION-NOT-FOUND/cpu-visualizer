// Instruction and data memories (4 KB each, separate address spaces).
// Contents come from +prog=<file> and +data=<file> (one 32-bit hex word per line).

module rv_imem (
  input  logic [31:0] addr,
  output logic [31:0] rd
);
  logic [31:0] mem [0:1023];
  string file;

  initial begin
    for (int i = 0; i < 1024; i++) mem[i] = 32'b0;
    if ($value$plusargs("prog=%s", file)) $readmemh(file, mem);
  end

  assign rd = mem[addr[11:2]];
endmodule

module rv_dmem (
  input  logic        clk,
  input  logic        we,
  input  logic [3:0]  be,     // byte enables
  input  logic [31:0] addr,
  input  logic [31:0] wd,
  output logic [31:0] rd
);
  logic [31:0] mem [0:1023];
  string file;

  initial begin
    for (int i = 0; i < 1024; i++) mem[i] = 32'b0;
    if ($value$plusargs("data=%s", file)) $readmemh(file, mem);
  end

  always_ff @(posedge clk)
    if (we) begin
      if (be[0]) mem[addr[11:2]][7:0]   <= wd[7:0];
      if (be[1]) mem[addr[11:2]][15:8]  <= wd[15:8];
      if (be[2]) mem[addr[11:2]][23:16] <= wd[23:16];
      if (be[3]) mem[addr[11:2]][31:24] <= wd[31:24];
    end

  assign rd = mem[addr[11:2]];
endmodule
