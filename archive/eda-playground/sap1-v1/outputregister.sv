`timescale 1ns/1ps

module outputregister (
  input clk,
  input reset,
  input load,                     // Load data into the Output Register
  input [7:0] data_in,            // Data input to Output Register
  output [7:0] two_state_out      // Direct output for display
);

  Register #(.size(8)) regOut (
    .clk(clk),
    .reset(reset),
    .load(load),
    .enable(1'b0),                // Disable three-state output as it doesn't need bus output
    .data_in(data_in),
    .two_state_out(two_state_out),
    .three_state_out()            // Unused three-state output
  );

endmodule
