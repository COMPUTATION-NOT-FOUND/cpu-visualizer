# Bug 5 (old pipeline): the load-use stall also cleared the load itself in the
# Memory register, so the loaded value never arrived.
# expect t0=1 a0=2 a1=7
        .data
one:    .word 1
        .text
        lw   t0, one(zero)
        add  a0, t0, t0      # needs t0 right away: one-cycle stall, then forward
        addi a1, a0, 5
        ecall
