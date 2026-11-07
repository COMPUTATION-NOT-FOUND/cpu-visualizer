module ACC(
  input logic reset,
  input logic clk,
  input logic l,
  input logic e,
  input logic [7:0] datain,
  output logic [7:0] dataout,
  output logic [7:0] dataout2
);
  
  reg [7:0] data;


  always_ff @(posedge clk or posedge reset) begin
    if (reset) begin
      data <= 8'b0; 
    end else if (l) begin
      data <= datain; 
    end
  end

 	assign dataout = data 	; 
  assign dataout2 = e ? data : 8'bzzzzzzzz; 

endmodule
