`timescale 1ns/1ps

`include "Register.sv"

module accumulator (
  input clk,
  input reset,
  input load,                     // Load data into the accumulator
  input enable,                   // Enable output onto the bus
  input [7:0] data_in,            // Data input to the accumulator
  output [7:0] two_state_out,     // Direct output for ALU connection
  output [7:0] three_state_out    // Three-state output for the bus
);

  Register #(.size(8)) regA (
    .clk(clk),
    .reset(reset),
    .load(load),
    .enable(enable),
    .data_in(data_in),
    .two_state_out(two_state_out),
    .three_state_out(three_state_out)
  );

endmodule
