`timescale 1ns/1ps

module controllersequencer(
  input clk,
  input reset,
  input [3:0] opcode,
  output reg PC_enable, // Enable PC (active high)
  output reg PC_inc,    // Enable PC count (active high)
  output reg IR_load,   // Load instruction register (active low)
  output reg IR_enable, // Enable IR on the bus (active low)
  output reg RA_load,   // Load accumulator (active low)
  output reg RA_enable, // Enable accumulator (register A)
  output reg RB_load,   // Load B register (active low)
  output reg MAR_load,  // Load memory address register (active low)
  output reg RAM_read,  // Read from RAM (active low)
  output reg ALU_sub,   // must think about this
  output reg ALU_enable, // Enable ALU
  output reg OUT_load,   // Load output register (active low) and is directly connected to display
  output reg hlt        
);

  typedef enum reg [5:0] {
    buffer = 6'b111111, // Buffer state for when CU is turned on
    T0 = 6'b000000, 
    T1 = 6'b000001, 
    T2 = 6'b000010, 
    T3 = 6'b000100, 
    T4 = 6'b001000, 
    T5 = 6'b010000
  } state_t;

  state_t state, next_state;

  // Sequential block for state update based on reset
  always @(posedge clk or posedge reset) begin
    if (reset) begin
      state <= buffer;  // Buffer state for when CU is turned on
    end
  end

  // Next state logic (always runs continuously)
  always @(*) begin
    case (state)
      buffer: next_state = T0;
      T0: next_state = T1;
      T1: next_state = T2;
      T2: next_state = T3;
      T3: next_state = T4;
      T4: next_state = T5;
      T5: next_state = T0;
      default: next_state = T0;
    endcase
  end

  // Control signals based on current state and opcode
  always @(*) begin
    // Default values (reset state)
    PC_enable = 0;   // Active High
    PC_inc = 0;      // Active High
    IR_load = 1;     // Active low
    IR_enable = 1;   // Active low
    MAR_load = 1;    // Active low
    RAM_read = 1;    // Active low
    RA_load = 1;     // Active low
    RA_enable = 0;   // Active high for RA_enable
    RB_load = 1;     // Active low
    ALU_sub = 0;     // 0 for ADD and 1 for SUB
    ALU_enable = 0;  // Active High
    OUT_load = 1;    // Active low
    hlt = 0;         // Default value

    case (state)
      T0: begin
        // Fetch state, set control signals
        PC_enable = 1;  // Load PC onto W bus
        MAR_load = 0;  // Load the address into MAR
      end
      T1: begin
        PC_inc = 1;    // Increment the Program Counter
      end
      T2: begin
        RAM_read = 0;  // Read instruction from RAM
        IR_load = 0;   // Load instruction into IR
      end
      T3: begin
        case (opcode)
          4'b0000: begin // LDA operation
            IR_enable = 0; // Load IR address onto W bus
            IR_load = 1;   // Deactivate IR load
            MAR_load = 0;  // Load MAR with address from IR through W bus
          end
          4'b0001: begin // ADD operation
            IR_enable = 0; // Load IR address onto W bus
            IR_load = 1;   // Deactivate IR load
            MAR_load = 0;  // Load MAR with address from IR through W bus
          end
          4'b0010: begin // SUB operation
            IR_enable = 0; // Load IR address onto W bus
            IR_load = 1;   // Deactivate IR load
            MAR_load = 0;  // Load MAR with address from IR through W bus
          end
          4'b1110: begin // OUT opcode
            RA_enable = 1;  // Load Accumulator result onto W bus
            OUT_load = 0;   // Store result from accumulator in Output Register through W bus
          end
          4'b1111: begin
            hlt = 1;      // Halt the operation
            OUT_load = 1; // Deactivate load of Output Register
          end
          default: ;
        endcase
      end
      T4: begin
        case (opcode)
          4'b0000: begin
            RAM_read = 0;  // Read data from RAM for LDA
            RA_load = 0;   // Load data into Accumulator
          end
          4'b0001: begin
            RAM_read = 0;  // Read data from RAM for ADD
            RB_load = 0;   // Load data into B register
          end
          4'b0010: begin
            RAM_read = 0;  // Read data from RAM for SUB
            RB_load = 0;   // Load data into B register
          end
          4'b1110: begin
            OUT_load = 1;   // Deactivate Output Register load
          end
          default: ;
        endcase
      end
      T5: begin
        case (opcode)
          4'b0001: begin
            ALU_enable = 1;  // Load ALU result
            ALU_sub = 0;    // Perform ADD
            RA_load = 0;    // Store result in A
          end
          4'b0010: begin
            ALU_sub = 1;    // Perform SUB
            ALU_enable = 1; // Load ALU result
            RA_load = 0;    // Store result in A
          end
          default: ;
        endcase
      end
      default: ;
    endcase
  end
  
  always @(negedge clk) begin
      state <= next_state;  // State change at every negative edge of the clock
  end
endmodule
