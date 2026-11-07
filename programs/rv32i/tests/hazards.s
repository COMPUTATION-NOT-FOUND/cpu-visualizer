# Forwarding from Memory and Writeback on both operands, x0 never forwarded,
# load-use stalls on rs1 and rs2, and load -> store data.
# expect a0=3 a1=6 a2=9 a3=0 a4=10 a5=20 a6=7 m[0x20]=7 s0=11
        .data
vals:   .word 10, 20
        .text
        li   t0, 1
        li   t1, 2
        add  a0, t0, t1      # rs1 from W, rs2 from M      -> 3
        add  a1, a0, a0      # both from M                 -> 6
        add  a2, a1, a0      # rs1 from M, rs2 from W      -> 9
        addi zero, zero, 5   # writes x0: must not forward
        add  a3, zero, zero  # -> 0
        lw   a4, vals(zero)
        add  t2, zero, a4    # load-use on rs2
        lw   a5, vals+4(zero)
        add  t3, a5, zero    # load-use on rs1
        addi a6, zero, 7
        sw   a6, 0x20(zero)
        lw   t4, 0x20(zero)
        sw   t4, 0x24(zero)  # load -> store data (needs stall)
        lw   s0, 0x24(zero)
        addi s0, s0, 4       # 7 + 4 = 11
        ecall
