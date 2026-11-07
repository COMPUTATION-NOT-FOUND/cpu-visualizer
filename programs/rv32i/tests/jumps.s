# jal/jalr, nested calls with a stack, an odd jalr target (low bit cleared),
# jalr on a just-computed register (forwarding), and lui/auipc.
# expect a0=25 s1=0x12345000 s2=0x12345678 s3=4 s4=1 sp=0x800
        li   sp, 0x800
        li   a0, 5
        call square          # a0 = 25
        lui  s1, 0x12345
        addi s2, s1, 0x678
here:   auipc s3, 0          # s3 = address of "here"
        sub  s3, s3, s3
        addi s3, s3, 4
        la   t0, odd
        addi t0, t0, 1       # odd address: jalr must clear bit 0
        jalr ra, t0, 0       # also forwards t0 from the previous instruction
        ecall
odd:    li   s4, 1
        ret

square: addi sp, sp, -8
        sw   ra, 4(sp)
        sw   a0, 0(sp)
        mv   a1, a0
        call mul             # nested call
        lw   ra, 4(sp)
        addi sp, sp, 8
        ret

# a0 = a0 * a1 by repeated addition (a1 > 0)
mul:    mv   t1, a0
        li   a0, 0
mloop:  add  a0, a0, t1
        addi a1, a1, -1
        bnez a1, mloop
        ret
