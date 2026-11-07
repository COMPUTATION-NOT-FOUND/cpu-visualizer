module MAR (
  input logic reset,
  input logic clk,
  input logic lm,
  input logic [3:0] addressin,
  output logic [3:0] addressout
);
  
  logic [3:0] address;

  always_ff @(posedge clk or posedge reset) begin
    if (reset) begin
      address <= 4'b0; 
    end else if (lm) begin
      address <= addressin;
    end
  end
  

 assign addressout = address; 

endmodule
