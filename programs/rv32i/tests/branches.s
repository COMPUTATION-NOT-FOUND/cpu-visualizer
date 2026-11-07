# All six branch conditions, taken and not taken, signed vs unsigned,
# and a backward counting loop. s0 counts correct decisions (12 expected).
# expect s0=12 s1=55 t0=0
        li   t2, -1
        li   t3, 1
        li   s0, 0
        beq  t3, t3, ok1      # taken
        j    fail
ok1:   addi s0, s0, 1
        beq  t2, t3, fail    # not taken
        addi s0, s0, 1
        bne  t2, t3, ok2      # taken
        j    fail
ok2:   addi s0, s0, 1
        bne  t3, t3, fail
        addi s0, s0, 1
        blt  t2, t3, ok3      # -1 < 1 signed: taken
        j    fail
ok3:   addi s0, s0, 1
        blt  t3, t2, fail
        addi s0, s0, 1
        bge  t3, t2, ok4      # taken
        j    fail
ok4:   addi s0, s0, 1
        bge  t2, t3, fail
        addi s0, s0, 1
        bltu t3, t2, ok5      # 1 < 0xffffffff unsigned: taken
        j    fail
ok5:   addi s0, s0, 1
        bltu t2, t3, fail
        addi s0, s0, 1
        bgeu t2, t3, ok6      # taken
        j    fail
ok6:   addi s0, s0, 1
        bgeu t3, t2, fail
        addi s0, s0, 1
        # sum 1..10 with a backward branch
        li   t0, 10
        li   s1, 0
loop:   add  s1, s1, t0
        addi t0, t0, -1
        bnez t0, loop
        ecall
fail:   .word 0xffffffff
