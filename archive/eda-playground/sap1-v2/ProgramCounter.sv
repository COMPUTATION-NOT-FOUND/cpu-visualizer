module PC (
  input logic reset,
  input logic clk,
  input logic cp,  
  input logic ep,  
  output logic [7:0] nextinstruction  
);
  
  reg [3:0] count ;  

  always_ff @(posedge clk or posedge reset) begin
    if (reset) begin
      count <= 4'b0;  
    end else if (cp) begin
      count <= (count + 1)%8;  
    end
  end

  always@(ep) begin 
      nextinstruction <= ep ? {4'b0000,count} : 8'bzzzzzzzz;
end

endmodule
