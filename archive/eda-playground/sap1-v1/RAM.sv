`timescale 1ns/1ps

module RAM16x8(
  input [3:0] address,
  input RAM_read,
  input Write_enable,
  input [7:0] data,
  output reg [7:0] data_out
);

  reg [7:0] memory [15:0]; // Declare a 16x8 memory array

  // Initialize memory to 0
  initial begin
    memory[0] = 8'b00001001; // LDA 9
    memory[1] = 8'b00011010; // ADD 10
    memory[2] = 8'b00011011; // ADD 11
    memory[3] = 8'b00101100; // SUB 12
    memory[4] = 8'b11100000; // OUT
    memory[5] = 8'b11111111; // HLT
    memory[6] = 8'b00000000;
    memory[7] = 8'b00000000;
    memory[8] = 8'b00000000;
    memory[9] = 8'b00010000;
    memory[10] = 8'b00010100;
    memory[11] = 8'b00011000;
    memory[12] = 8'b00100000;
    memory[13] = 8'b00000000;
    memory[14] = 8'b00000000;
    memory[15] = 8'b00000000;
    
    data_out = 8'b00000000; // Initialize data_out to a known value
  end

  // Write to memory when Write_enable is high
  always @(*) begin
    if (Write_enable) begin
      memory[address] = data; // Immediate write to memory
    end
  end
  
  // Read from memory when RAM_read is enabled and Write_enable is not active
  always @(*) begin
    if (~RAM_read) begin
      data_out = memory[address]; // Read data from memory
    end else begin
      data_out = 8'bz; // High impedance when not reading
      end
  end


endmodule
