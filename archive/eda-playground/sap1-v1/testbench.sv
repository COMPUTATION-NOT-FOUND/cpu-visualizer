`timescale 1ns/1ps

module SAP1_Testbench;

    // Inputs
    reg clk;
    reg clr;

    // Outputs
    output reg [7:0] binary_display;

    // Instantiate the CPU module
    CPU uut (
        .clk(clk),
        .clr(clr),
        .binary_display(binary_display)
    );

    // Clock generation
    always #5 clk = ~clk; // 10ns clock period

    // Test program
    initial begin
      
      $dumpfile("SAP1_Testbench.vcd"); // Name of the dump file
        $dumpvars(0, SAP1_Testbench);    // Dump all variables in the testbench

      $display("\nStarting SAP-1 Testbench...\n");
      $monitor("Time = %0d | Binary Display = %0d", $time, binary_display);

        // Initialize inputs
        clk = 0;
        clr = 1;

        // Clear the CPU
        #5 clr = 0;  // Release reset after 10ns

        // Simulate the instruction cycle
        // Step-by-step verification of each phase (Fetch, Decode, Execute)

        // Program loaded into RAM:
        // Address | Data
        // ----------------
        // 0x0     | 0x01 (LDA 0x1) - Load memory at address 1 into Accumulator
        // 0x1     | 0x02 (ADD 0x2) - Add memory at address 2 to Accumulator
        // 0x2     | 0x0F (OUT)     - Output Accumulator value
        // 0x3     | 0xF0 (HLT)     - Halt execution


        // Wait for instructions to execute
        #1500; // Wait sufficient time for program to run
		
        // End simulation
        $finish;
    end
endmodule
