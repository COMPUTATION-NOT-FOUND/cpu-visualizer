module testbench();
 logic clk;
 logic reset;
 logic [31:0] WriteData, DataAdr;
 logic MemWrite;
 // instantiate device to be tested
 top dut(clk, reset, WriteData, DataAdr, MemWrite);
 // initialize test
 initial
 begin
 reset <= 1; 
 # 10; 
 reset <= 0;
 # 260;
 $stop;
 end
 // generate clock to sequence tests
 always
 begin
 clk <= 0; 
 # 5;
 clk <= 1; 
 # 5;
 end

  initial begin
    $dumpfile("dump.vcd");
    $dumpvars(0);
  end
endmodule