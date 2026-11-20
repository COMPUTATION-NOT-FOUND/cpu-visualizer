// Programs shown in the guide. Each one is run by tools/check-guide.mjs, which checks
// the `expect` values, so the guide can't drift from what the assemblers accept.
// Kept free of DOM code so Node can import it.

export const SAMPLES = {
  sap1: {
    expression: {
      title: 'Work out 7 + 9 - 3',
      expect: { outputs: [13] },
      source: `; result = 7 + 9 - 3
        LDA a        ; A = 7
        ADD b        ; A = A + 9
        SUB c        ; A = A - 3
        OUT          ; show A on the output register
        HLT          ; stop the clock
a:      .byte 7
b:      .byte 9
c:      .byte 3
`,
    },
    multiply: {
      title: 'Multiply 6 x 4 by adding four times',
      expect: { outputs: [24] },
      source: `; SAP-1 has no multiply and no loops, so repeat the ADD.
; result = 6 * 4 = 6 + 6 + 6 + 6
        LDA six      ; A = 6
        ADD six      ; 12
        ADD six      ; 18
        ADD six      ; 24
        OUT
        HLT
six:    .byte 6
`,
    },
    org: {
      title: 'Put data at a fixed address with .org',
      expect: { outputs: [15, 5] },
      source: `; Code at 0..5, data from address 12 on.
        LDA x        ; A = 10
        ADD y        ; A = 15
        OUT
        SUB x        ; A = 5
        OUT
        HLT
        .org 12
x:      .byte 10
y:      .byte 5
`,
    },
  },
  rv32i: {
    sum: {
      title: 'Add up 1 to 10 with a for loop',
      expect: { regs: { a0: 55 } },
      source: `# sum = 0
# for i = 1 to 10: sum = sum + i
#
# registers: a0 = sum, t0 = i, t1 = 10
        li   a0, 0          # sum = 0
        li   t0, 1          # i = 1
        li   t1, 10
loop:   bgt  t0, t1, done   # leave the loop when i > 10
        add  a0, a0, t0     # sum = sum + i
        addi t0, t0, 1      # i = i + 1
        j    loop
done:   ecall               # stop: a0 holds 55
`,
    },
    max: {
      title: 'if / else: the larger of two numbers',
      expect: { regs: { a0: 42 }, mem: { 8: 42 } },
      source: `# a = 17, b = 42
# if a > b: max = a  else: max = b
# store max in memory at "result"
        .data
a:      .word 17
b:      .word 42
result: .word 0
        .text
        la   t0, a
        lw   t1, 0(t0)       # t1 = a
        lw   t2, 4(t0)       # t2 = b
        ble  t1, t2, else    # branch on the OPPOSITE test
        mv   a0, t1          # then: max = a
        j    endif
else:   mv   a0, t2          # else: max = b
endif:  la   t3, result
        sw   a0, 0(t3)       # result = max
        ecall
`,
    },
    gcd: {
      title: 'while loop: greatest common divisor',
      expect: { regs: { a0: 6 } },
      source: `# x = 48, y = 18
# while x != y:
#     if x > y: x = x - y
#     else:     y = y - x
# result = x
        li   a0, 48          # x
        li   a1, 18          # y
while:  beq  a0, a1, done    # loop ends when x == y
        ble  a0, a1, ysub
        sub  a0, a0, a1      # x = x - y
        j    while
ysub:   sub  a1, a1, a0      # y = y - x
        j    while
done:   ecall                # a0 = 6
`,
    },
    array: {
      title: 'Arrays: sum the elements, then double each one',
      expect: { regs: { a0: 30 }, mem: { 0: 6, 4: 14, 8: 2, 12: 18, 16: 20 } },
      source: `# A = [3, 7, 1, 9, 10]
# total = 0
# for i = 0 to 4:
#     total = total + A[i]
#     A[i] = A[i] * 2
        .data
A:      .word 3, 7, 1, 9, 10
        .text
        la   s0, A           # s0 = address of A[0]
        li   s1, 5           # length
        li   a0, 0           # total
        li   t0, 0           # i
loop:   bge  t0, s1, done
        slli t1, t0, 2       # byte offset = i * 4 (each word is 4 bytes)
        add  t1, s0, t1      # t1 = address of A[i]
        lw   t2, 0(t1)       # t2 = A[i]
        add  a0, a0, t2      # total += A[i]
        slli t2, t2, 1       # A[i] * 2 (shift left by one)
        sw   t2, 0(t1)       # A[i] = A[i] * 2
        addi t0, t0, 1
        j    loop
done:   ecall                # a0 = 30, A = [6, 14, 2, 18, 20]
`,
    },
    func: {
      title: 'Functions: call, arguments and return',
      expect: { regs: { a0: 25, s0: 25 } },
      source: `# def square(n):      # n arrives in a0, the answer goes back in a0
#     return n * n     # RV32I has no multiply: add n to itself n times
# result = square(5)
        li   a0, 5
        call square          # jump to square, return address in ra
        mv   s0, a0          # result = 25
        ecall

square: mv   t0, a0          # t0 = how many adds are left
        li   t1, 0           # t1 = running product
sq_loop:
        beqz t0, sq_done
        add  t1, t1, a0
        addi t0, t0, -1
        j    sq_loop
sq_done:
        mv   a0, t1          # return value in a0
        ret                  # jump back to ra
`,
    },
    stack: {
      title: 'The stack: a function that calls another',
      expect: { regs: { a0: 14 } },
      source: `# sp starts at 0, so set it to the top of data memory first.
# def double(n): return n + n
# def double_plus_four(n): return double(n) + 4
# result = double_plus_four(5)
        li   sp, 4096        # stack grows down from the top of memory
        li   a0, 5
        call double_plus_four
        ecall                # a0 = 14

double_plus_four:
        addi sp, sp, -4      # make room for one word
        sw   ra, 0(sp)       # save our return address: the next call overwrites ra
        call double
        addi a0, a0, 4
        lw   ra, 0(sp)       # restore it
        addi sp, sp, 4
        ret

double: add  a0, a0, a0
        ret
`,
    },
    hazards: {
      title: 'Watch forwarding, a load-use stall and a branch flush',
      expect: { regs: { t3: 15, t4: 0 } },
      source: `# Step this one clock at a time (S) and watch the hazard unit.
        .data
v:      .word 7
        .text
        addi t0, zero, 5
        addi t1, t0, 3       # needs t0 one cycle later: forwarded from MEM
        lw   t2, 0(zero)     # t2 = 7
        add  t3, t2, t1      # needs t2 straight after the load: one stall
        beq  zero, zero, end # always taken: the next two are flushed
        addi t4, zero, 1     # never runs
        addi t5, zero, 1     # never runs
end:    ecall
`,
    },
  },
};
