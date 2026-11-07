`timescale 1ns/1ps

module MAR (
  input clk,
  input reset,
  input load,                     // Load the address into the MAR
  input [3:0] address_in,         // 4-bit address input to MAR from PC
  output reg [3:0] address_out    // 4-bit address output for memory addressing
);

   Register #(.size(4)) MAR (
        .clk(clk),
     	.reset(reset),
     	.load(load),
        .enable(1'b0), // MAR doesn't output to the bus
     	.data_in(address_in),
        .two_state_out(address_out),
        .three_state_out() // Unused for MAR
    );

endmodule
