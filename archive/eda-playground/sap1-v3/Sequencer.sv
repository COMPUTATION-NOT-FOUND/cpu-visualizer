module ControllerSequencer
  #(parameter 
  T0= 4'b0000,T1= 4'b0001,T2= 4'b0010,T3= 4'b0011,
  T4= 4'b0100,T5= 4'b0101,T6= 4'b0110,T7= 4'b0111,
  T8= 4'b1000,T9= 4'b1001,T10= 4'b1010,T11= 4'b1011,
  T12=4'b1100,T13= 4'b1101,T14= 4'b1110 , T15= 4'b1111 )
( 
  input logic clk,
  input logic reset,
  input logic [3:0] cs_in,
  output logic clk_out,
  output logic clr_out,
  output logic [11:0] cs_out,
  output logic halt
  
);
  
  logic [3:0] state;
  logic [3:0] nextstate;
  
  
  // Current state
  always_ff @(negedge clk or posedge reset) begin
    if (reset)
      state <= T0;
    else
      state <= nextstate;
  end
  
  // Next state logic
  always_comb begin
    case(state)
      T0: nextstate = T1;
      T1: nextstate = T2;
      T2:begin
  
        if (cs_in == 4'b0000)
          nextstate = T3;
        else if (cs_in == 4'b0001)
          nextstate=T6;
        else if (cs_in == 4'b0010)
          nextstate = T9;
        else if(cs_in == 4'b1110)
          nextstate = T12;
        else if (cs_in == 4'b1111)
          nextstate = T15;
         else
          nextstate = T0;
      end
      T3: nextstate = T4;
      T4: nextstate = T5;
      
      T6: nextstate = T7;
      T7: nextstate = T8;
      
      T9: nextstate = T10;
      T10: nextstate = T11;
      
      T12: nextstate = T13;
      T13: nextstate = T14;
      
      default: nextstate = T0;
    endcase
  end
  
  // Action output logic
  always_comb begin
    case(state)
      T0: cs_out = 12'h5E3;
      T1: cs_out = 12'hBE3;
      T2: cs_out = 12'h263;
      
      T3: cs_out = 12'h1A3;
      T4: cs_out = 12'h2C3;
      T5: cs_out = 12'h3E3;
      
      T6: cs_out = 12'h1A3;
      T7: cs_out = 12'h2E1;
      T8: cs_out = 12'h3c7;
      
      T9: cs_out = 12'h1A3;
      T10: cs_out = 12'h2E1;
      T11: cs_out = 12'h3CF;
      
      T12: cs_out = 12'h3F2;
      T13: cs_out = 12'h3E3;
      T14: cs_out = 12'h3E3;
      
      T15:	halt  =	1'b1;
      
      
      default: cs_out= 12'h3E3;// Default case to prevent latches
    endcase
  end
  
 assign clk_out=clk;
  assign clr_out=reset;
endmodule