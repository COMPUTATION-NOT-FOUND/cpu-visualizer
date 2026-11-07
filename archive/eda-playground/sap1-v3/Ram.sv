module RAM(
    input logic [3:0] a,
    input logic ceb,
    output logic [7:0] rd 
);

    logic [7:0] RAM[15:0];

    initial begin
      RAM[0] <= 8'h09;
        RAM[1] <= 8'h1A; 
        RAM[2] <= 8'hE0; 
      	RAM[3] <= 8'h18; 
      	RAM[4] <= 8'hE0; 
        RAM[5] <= 8'h2b; 
     	RAM[6] <= 8'hE0; 	
        RAM[7] <= 8'h00; 
        RAM[8] <= 8'h10; 
        RAM[9] <= 8'h14; 
        RAM[10] <= 8'h18; 
        RAM[11] <= 8'h20; 
        RAM[12] <= 8'h00; 
        RAM[13] <= 8'h00; 
        RAM[14] <= 8'h00; 
        RAM[15] <= 8'h00; 
    end

    assign rd = ceb ?  RAM[a]:8'bzzzzzzzz ;
endmodule