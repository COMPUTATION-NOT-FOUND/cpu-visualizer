`timescale 1ns/1ps

`include "accumulator.sv"
`include "controllersequencer.sv"
`include "registerB.sv"
`include "outputregister.sv"
`include "MAR.sv"
`include "addersubtractor.sv"
`include "RAM.sv"
`include "programcounter.sv"
`include "instructionregister.sv"

module CPU (
    input clk,
    input clr,
    output reg [7:0] binary_display
);
    // W_bus (8-bit)
    wire [7:0] W_bus;

    // Program Counter (PC)
    wire [3:0] PC_out;
    wire PC_enable, PC_inc;
    programcounter PC (
      	.clk(clk),
      	.reset(~clr),
        .Count_enable(PC_inc),
        .enable(PC_enable),
      	//.out(PC_out)
      	.out(W_bus[3:0])
    );
    //assign W_bus[3:0] = PC_out; // testing purposes

    // Memory Address Register (MAR)
    wire [3:0] MAR_out;
    wire MAR_load;
    MAR mar (
        .clk(clk),
        .reset(clr),
        .load(MAR_load),
        .address_in(W_bus[3:0]),
        .address_out(MAR_out)
    );

    // RAM (16x8)
    //wire [7:0] RAM_out;
    wire RAM_read, RAM_write;
    RAM16x8 ram (
        .address(MAR_out),
        .RAM_read(RAM_read),
        .Write_enable(RAM_write),
      	.data(W_bus),
      	.data_out(W_bus)
    );
  	//assign RAM_out = W_bus;

    // Instruction Register (IR)
    wire [3:0] IR_opcode;
 	//wire [3:0] IR_out;
    wire IR_load, IR_enable;
    instructionregister IR (
        .clk(clk),
        .clr(clr),
        .load(IR_load),
        .enable(IR_enable),
        .data_in(W_bus),
        .opcode_out(IR_opcode),
      	.w_bus_out(W_bus[3:0])
    );
  	//assign IR_out = W_bus[3:0]; // testing purposes

    // Accumulator (A)
    wire [7:0] Acc_out;
    wire Acc_load, Acc_enable;
    accumulator acc (
        .clk(clk),
        .reset(clr),
        .load(Acc_load),
        .enable(Acc_enable),
        .data_in(W_bus),
        .two_state_out(Acc_out),
      	.three_state_out(W_bus)
    );

    // Register B
    wire [7:0] B_out;
    wire B_load;
    registerB reg_b (
        .clk(clk),
        .reset(clr),
        .load(B_load),
        .data_in(W_bus),
        .two_state_out(B_out)
    );

    // Adder/Subtractor
    //wire [7:0] ALU_out;
    wire ALU_sub, ALU_enable;
    addersubtractor alu (
        .enable(ALU_enable),
        .Sub(ALU_sub),
        .A(Acc_out),
        .B(B_out),
      	.answer(W_bus)
    );
  	//assign ALU_out = W_bus;

    // Output Register
    wire Out_load;
    outputregister out_reg (
        .clk(clk),
        .reset(clr),
        .load(Out_load),
        .data_in(W_bus),
        .two_state_out(binary_display)
    );
  	//assign Out_load = output_display; // testing purposes

    // Controller/Sequencer
  	wire hlt;
  	controllersequencer ctrl_seq (
    	.clk(clk),
        .reset(clr),
        .opcode(IR_opcode),
        .PC_enable(PC_enable),
        .PC_inc(PC_inc),
        .IR_load(IR_load),
        .IR_enable(IR_enable),
        .RA_load(Acc_load),
        .RA_enable(Acc_enable),
        .RB_load(B_load),
        .MAR_load(MAR_load),
        .RAM_read(RAM_read),
        .ALU_sub(ALU_sub),
        .ALU_enable(ALU_enable),
        .OUT_load(Out_load),
      	.hlt(hlt)
    );
  	
  always @(*) begin
    if (hlt) begin
      $display("Time = %0d | CPU halted!\n", $time);
      if (binary_display == 8'b00011100) begin
        $display("Test Passed: Expected Binary Display = 28, Actual Binary Display = %0d\n", binary_display);
      end else begin
        $display("Test Failed: Expected Binary Display = 28, Actual Binary Display = %0d\n", binary_display);
      end
      $finish;
    end
  end

endmodule