`timescale 1ns/1ps

module registerB (
  input clk,                      // Clock signal
  input reset,                    // Reset signal
  input load,                     // Load data into Register B
  input [7:0] data_in,            // 8-bit data input to Register B
  output [7:0] two_state_out      // Direct output for ALU connection (two-state output)
);

  // Instantiate Register with size 8
  Register #(.size(8)) regB (
    .clk(clk),                      // Clock signal to the register
    .reset(reset),                  // Reset signal for the register
    .load(load),                    // Control to load data into the register
    .enable(1'b0),                  // Disable three-state output since Register B doesn't need bus connection
    .data_in(data_in),              // Data input to the register
    .two_state_out(two_state_out),  // ALU connection output (two-state signal)
    .three_state_out()              // Unused three-state output, left unconnected
  );

endmodule
