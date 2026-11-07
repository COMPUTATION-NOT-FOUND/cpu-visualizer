# Bug 3 (old pipeline): the J-type immediate dropped its implicit low 0 bit,
# so jal jumped half the distance and ran the instructions it should skip.
# expect a0=0 a1=0 a2=3 a3=4 ra=4
        jal  ra, target
        li   a0, 1
        li   a1, 2
target: li   a2, 3
        li   a3, 4
        ecall
