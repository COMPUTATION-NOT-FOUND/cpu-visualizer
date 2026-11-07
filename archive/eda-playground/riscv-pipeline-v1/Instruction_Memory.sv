module imem(input logic [31:0] a,
             output logic [31:0] rd);
  logic [31:0] RAM[63:0];
 initial
   begin
     
     RAM [0]=32'h15600293;
     RAM [1]=32'hfff2c313;
     RAM [2]=32'h0e700393;
     RAM [3]=32'hfff3ce13;
     RAM [4]=32'h006e6eb3;
     RAM [5]=32'h00000013;
     RAM [6]=32'h00000013;
     RAM [7]=32'h00000013;



  end
 assign rd = RAM[a[31:2]]; // word aligned
endmodule




