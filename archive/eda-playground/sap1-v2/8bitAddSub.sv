module fulladder(input logic A, input logic B, input logic C, output logic sum, output logic carry);

  assign sum = A ^ B ^ C;
  assign carry = (A & B) | (C & (A | B));

endmodule  


module ADDSUB(input logic [7:0] A, input logic [7:0] B, input logic add_sub , input logic e, output logic [7:0] sumout );

  wire co0,co1,co2,co3,co4,co5,co6,co7;
  logic [7:0] sum;
  fulladder FA0(A[0], (add_sub ? ~B[0] : B[0]), add_sub, sum[0], co0);
  fulladder FA1(A[1], (add_sub ? ~B[1] : B[1]), co0, sum[1], co1);
  fulladder FA2(A[2], (add_sub ? ~B[2] : B[2]), co1, sum[2], co2);
  fulladder FA3(A[3], (add_sub ? ~B[3] : B[3]), co2, sum[3], co3);
  fulladder FA4(A[4], (add_sub ? ~B[4] : B[4]), co3, sum[4], co4);
  fulladder FA5(A[5], (add_sub ? ~B[5] : B[5]), co4, sum[5], co5);
  fulladder FA6(A[6], (add_sub ? ~B[6] : B[6]), co5, sum[6], co6);
  fulladder FA7(A[7], (add_sub ? ~B[7] : B[7]), co6, sum[7], co7);
  
  always@(e) begin            
   sumout = e ? sum:8'bzzzzzzzz;
 end

 
endmodule