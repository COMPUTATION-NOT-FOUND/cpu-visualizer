`timescale 1ns/1ps

module Register#(
  parameter size = 8  // Number of bits
)(
  input clk,
  input reset,
  input load,
  input enable,
  input [size - 1 : 0] data_in,
  output reg [size - 1 : 0] two_state_out, // Always on output (for direct connection e.g. accumulator to ALU or Output register to display
  output reg [size - 1 : 0] three_state_out // Output enabled when enable active (for bus)
);
  
  reg[size - 1 : 0] register;
  
  always@(posedge clk or posedge reset) begin
    if(reset)
      register <= {size{1'b0}};
    else if(!load)
      register <= data_in;
  end
  
  always@(*) begin
    two_state_out = register;
    
    if(enable) 
      three_state_out = register;
    else
      three_state_out = {size{1'bz}};
  end
endmodule
