`timescale 1ns/1ps

module programcounter (
    input clk,           // Active low clock
    input reset,         // Active low reset
    input Count_enable,     // Enable counting (increment)
    input enable,           // Enable output
    output reg [3:0] out    // 4-bit output
);

    // Register to hold the counter value
    reg [3:0] counter;
  	
  	initial begin
      counter <= 4'b0000;
    end

    // Counter logic, triggered on the negative edge of the clock or reset
  	always @(negedge clk or negedge reset) begin
      	if (!reset)      // Active low reset (when NOTreset is low)
            counter <= 4'b0000; // Reset counter to 0
        else if (Count_enable)  // Increment counter if Count_enable is high
            counter <= counter + 1;
    end

    // Output logic, synchronized with clock
  always @(*) begin
    	if (enable)    // Enable output if enable is high
            out = counter;
        else
            out = 4'bz;    // High impedance when output is disabled
    end

endmodule
