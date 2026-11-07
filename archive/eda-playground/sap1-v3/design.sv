`include "Sequencer.sv"
`include "Ram.sv"
`include "Mar.sv"
`include "ProgramCounter.sv"
`include "Register8Bit.sv"
`include "RegIR.sv"
`include "8bitAddSub.sv"
`include "Acc.sv"

module Sap1 (
input logic clksap,
input logic resetsap,
output logic [7:0] outsap,
output logic halt
);
  
  logic [7:0] databus;
  logic [11:0] controlbus;
  logic [7:0] acc_out, regb_out;
  logic [3:0] address,opcode;
  logic clk;
  logic reset;
  logic [7:0] sum_out,ram_out,acc_out2;
  logic [3:0] address_out,instruction_out;

  //contSroll bus encoding
  // cp = programcounter enable=controlbus[11]
  // ep =programcounter output enable=controlbus[10]
  // !lm =memory address write enable =controlbus[9]
  // !ce =ram output enable=controlbus[8]
  // !l1 =ir register write enable=controlbus[7]
  // !e1 =ir register ouput enable=controlbus[6]
  // !ea =accumulate output enable =controlbus[5]
  // !la =accumulate write enable=controlbus[4]
  // su =addsub sub enable=controlbus[3]
  // eu =addsub output enable=controlbus[2]
  // !lb =register b write enable =controlbus[1]
  // !lo =register output write enable enable=controlbus[0]
  
  
  
  
  
 
 ControllerSequencer cu (
        .clk(clksap),
        .reset(resetsap),
        .cs_in(opcode),        // opcode from IR register
        .clk_out(clk),
   		.clr_out(reset),
   		.cs_out(controlbus),
   		.halt(halt)// Output control signal to control bus
    );

    RAM Ram (
        .a(address),             // Address from MAR
        .ceb(~controlbus[8]),    // RAM output enable (active low)
      	.rd(ram_out)             // Data read from RAM to data bus
    );

    ACC acc (
        .clk(clk),
        .reset(reset),
      .l(~controlbus[5]),      // Load signal from control bus
      .e(controlbus[4]),      // Enable signal from control bus
        .datain(databus),        // Data to write from data bus
      	.dataout(acc_out),		//Data output to adder
      	.dataout2(acc_out2) 		// Data output to data bus
    );

    Reg8Bit RegB (
        .clk(clk),
        .reset(reset),
        .l(~controlbus[1]),      // Load signal from control bus
      	.e(1),                   // Enable signal always off
        .datain(databus),        // Data to write from data bus
      	.dataout(regb_out)       // Data output to adder
    );

    Reg8Bit Regout (
        .clk(clk),
        .reset(reset),
        .l(~controlbus[0]),      // Load signal from control bus
      	.e(1'b1),                   // Enable signal always on
        .datain(databus),        // Data to write from data bus
        .dataout(outsap)         // Data output to system output
    );

    RegIR ir (
        .clk(clk),
        .reset(reset),
        .l(~controlbus[7]),      // Load signal from control bus
        .e(~controlbus[6]),      // Enable signal from control bus
        .datain(databus),        // Data to write from data bus
      	.addressout(address_out),    // Address output to data bus
        .opcodeout(opcode)       // Feed the opcode to the sequencer
    );

    MAR Mar (
        .clk(clk),
        .reset(reset),
        .lm(~controlbus[9]),     // Load signal from control bus
      	.addressin(databus[3:0]),        // Data to write from data bus
        .addressout(address)        // Address output to RAM
    );

    PC pc (
      .clk(clk),
      .reset(reset),
        .cp(controlbus[11]),     // Program counter increment signal from control bus
        .ep(controlbus[10]),     // Program counter enable signal from control bus
      	.nextinstruction(instruction_out)        // Output data to data bus
    );

    ADDSUB addsub (
        .A(acc_out),             // Accumulator input
        .B(regb_out),            // Register B input
        .add_sub(controlbus[3]),       // Subtract enable signal from control bus
        .e(controlbus[2]),       // Enable signal from control bus
      	.sumout(sum_out)         // Sum output to data bus
    );
  
  always_comb begin
    case (controlbus)
      	12'h1A3: databus = {4'b0000 ,address_out};        
      	12'h5e3: databus = {4'b0000 ,instruction_out};       
        12'h3c7: databus = sum_out; 
      	12'h3cf: databus = sum_out; 
        12'h263: databus = ram_out;  
      	12'h2c3: databus = ram_out;
      	12'h2e1: databus = ram_out;
        12'h3f2: databus = acc_out2;
      	12'h3f3: databus = 8'bzzzz;
      	default:databus = 8'bzzzz;
           
    endcase
end
  
  endmodule