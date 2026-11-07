# Byte and halfword stores at every offset, and signed/unsigned loads.
# expect m[0]=0x44332211 m[4]=0xbeefcafe m[8]=0x800000ff
# expect a0=0xffffffff a1=0xff a2=0xffff8000 a3=0x8000 a4=0x22 a5=0xffffbeef a6=0x44332211
        li   t0, 0x11
        sb   t0, 0(zero)
        li   t0, 0x22
        sb   t0, 1(zero)
        li   t0, 0x33
        sb   t0, 2(zero)
        li   t0, 0x44
        sb   t0, 3(zero)
        li   t0, 0xcafe
        sh   t0, 4(zero)
        li   t0, 0xbeef
        sh   t0, 6(zero)
        li   t0, -1
        sb   t0, 8(zero)
        li   t0, 0x8000
        sh   t0, 10(zero)
        lb   a0, 8(zero)
        lbu  a1, 8(zero)
        lh   a2, 10(zero)
        lhu  a3, 10(zero)
        lbu  a4, 1(zero)
        lh   a5, 6(zero)
        lw   a6, 0(zero)
        ecall
