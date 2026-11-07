module Sap1_tb;

  logic clksap;
  logic resetsap;
  logic [7:0]outsap;
  logic halt;

  Sap1 uut (
    .clksap(clksap),
    .resetsap(resetsap),
    .outsap(outsap),
    .halt(halt)
  );
  
  
  initial begin
    clksap = 1;
    forever #5 clksap = ~clksap;
  end

 
  initial begin
  	resetsap = 1;  
    #10 resetsap = 0;  
    
    repeat (48) begin
      if(halt==1'b1)
        $finish;
      @(posedge clksap); 
    end

    $finish;
  end
  
 
  initial begin
    $dumpfile("sap1.vcd");  
    $dumpvars(0, Sap1_tb);  // Corrected the reference to the testbench module
  end

endmodule
