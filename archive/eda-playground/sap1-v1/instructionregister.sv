`timescale 1ns/1ps

module instructionregister (
  input clk,                   // Clock signal
  input clr,                   // Clear signal to reset IR
  input load,                  // Load signal (active low)
  input enable,                // Enable signal for output to W bus (active low)
  input [7:0] data_in,         // 8-bit data input from W bus
  output reg [3:0] opcode_out, // 4-bit opcode output to Controller Sequencer
  output reg [3:0] w_bus_out   // 4-bit output to W bus
);

  // Internal register to hold the instruction
  reg [7:0] instruction;

  // Load data into the instruction register or clear it
  always @(posedge clk or posedge clr) begin
    if (clr) 
      instruction <= 8'b0;       // Clear the instruction register
    else if (~load) 
      instruction <= data_in;    // Load new data when load is active low
  end

  // Tri-state buffer logic for W bus output
  always @(*) begin
    if (~enable) 
      w_bus_out = instruction[3:0]; // Least significant 4 bits to the W bus
    else 
      w_bus_out = 4'bz;             // High impedance when disabled
  end

  // Opcode output (MSBs of the instruction)
  always @(*) begin
    opcode_out = instruction[7:4];  // Most significant 4 bits are the opcode
  end

endmodule
