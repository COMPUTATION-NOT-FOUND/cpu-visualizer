# Bug 1 (old pipeline): the branch decision used (Zero | Negative) ^ funct3[0],
# so beq was taken for 1 vs 2 and bne was not; bltu/bgeu did not exist.
# expect a0=11 a1=22 a2=0 a3=44
        li   t0, 1
        li   t1, 2
        beq  t0, t1, skip    # 1 != 2: must fall through
        li   a0, 11
skip:   li   a1, 22
        bne  t0, t1, ok      # must branch
        li   a2, 33
ok:     li   a3, 44
        ecall
