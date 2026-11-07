# Fibonacci: writes the first 12 numbers to fib[] and leaves fib(11) in a0.
# expect a0=89 m[0x2c]=89
        .data
fib:    .space 48
        .text
        la   s0, fib
        li   s1, 12          # count
        li   t0, 0           # fib(n)
        li   t1, 1           # fib(n+1)
loop:   sw   t0, 0(s0)
        add  t2, t0, t1
        mv   t0, t1
        mv   t1, t2
        addi s0, s0, 4
        addi s1, s1, -1
        bnez s1, loop
        lw   a0, -4(s0)
        ecall
