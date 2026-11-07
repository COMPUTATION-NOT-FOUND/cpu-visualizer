module imem(input logic [31:0] a,
             output logic [31:0] rd);
  logic [31:0] RAM[63:0];
 initial
   begin
    
RAM[0]  = 32'h00002103; // lw x2, 0(x0)       // Address: 0x00
RAM[1]  = 32'h00202023; // sw x2, 0(x0)       // Address: 0x04
RAM[2]  = 32'h00000013; // nop                // Address: 0x08
RAM[3]  = 32'h00000013; // nop                // Address: 0x0C
RAM[4]  = 32'h00000013; // nop                // Address: 0x10
RAM[5]  = 32'h00000013; // nop                // Address: 0x14
RAM[6]  = 32'h00000013; // nop                // Address: 0x18
RAM[7]  = 32'h00000013; // nop                // Address: 0x1C

     



  end
 assign rd = RAM[a[31:2]]; // word aligned
endmodule




