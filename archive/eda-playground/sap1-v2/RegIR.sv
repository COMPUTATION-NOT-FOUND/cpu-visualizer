module RegIR(
    input logic reset,
    input logic clk,
    input logic l,
    input logic e,
    input logic [7:0] datain,
    output logic [3:0] opcodeout,
  output logic [7:0] addressout
);
  
    reg [3:0] opcode;
    reg [3:0] address;
 
    always_ff @(posedge clk or posedge reset) begin
        if (reset) begin
            opcode <= 4'b0;
            address <= 4'b0;
        end else begin
            if (l) begin
                opcode <= datain[7:4]; 
                address <= datain[3:0]; 
            end
        end
    end
  
    
    assign opcodeout = opcode;
  always@(e) begin
    addressout = e ? {4'b0000,address} : 8'bzzzzzzz;
  end

endmodule
