# Bug 4 (old pipeline): slt compared unsigned; sltu, xor and the shifts were missing.
# expect a0=1 a1=1 a2=0 a3=-1 a4=0x7fffffff a5=-4
        li   t0, -1
        slt  a0, t0, zero    # -1 < 0
        sltu a1, zero, t0    # 0 < 0xffffffff
        xor  a2, t0, t0
        srai a3, t0, 4       # arithmetic: stays -1
        srli a4, t0, 1
        slli a5, t0, 2
        ecall
