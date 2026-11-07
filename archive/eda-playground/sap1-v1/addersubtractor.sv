`timescale 1ns/1ps

module addersubtractor(
  input enable,        // Enables output to the bus
  input Sub,           // Subtraction control signal
  input [7:0] A,       // First operand (from Accumulator)
  input [7:0] B,       // Second operand (from Register B)
  output reg [7:0] answer // Result output (8 bits)
);

  reg [7:0] register;  // Internal register for intermediate result

  always @(*) begin
    if (Sub) begin
      register = A - B; // Perform subtraction
    end else begin
      register = A + B; // Perform addition
    end
    
    if (enable)
      answer = register; // Output only the lower 8 bits of the result
    else
      answer = 8'bz;          // High impedance if ALU is not enabled
  end
endmodule
