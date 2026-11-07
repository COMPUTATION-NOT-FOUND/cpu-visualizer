# Smoke test: arithmetic, branches, loads/stores, calls.
        .data
arr:    .word 5, -3, 7, 1
out:    .space 16
        .text
        li   sp, 0x1000
        la   a0, arr
        li   a1, 4
        call sum
        la   t0, out
        sw   a0, 0(t0)
        li   t1, 0x12345678
        sw   t1, 4(t0)
        lb   t2, 4(t0)
        lbu  t3, 7(t0)
        sh   t1, 8(t0)
        lh   t4, 8(t0)
        li   t5, -1
        sltu t6, zero, t5
        slt  s0, t5, zero
        srai s1, t5, 4
        srli s2, t5, 28
        lui  s3, 0xabcde
        auipc s4, 1
        blt  t5, zero, neg_ok
        li   s5, 99
neg_ok: bgeu t5, zero, uns_ok
        li   s5, 98
uns_ok: ecall

sum:    li   t0, 0
loop:   beqz a1, done
        lw   t1, 0(a0)
        add  t0, t0, t1
        addi a0, a0, 4
        addi a1, a1, -1
        j    loop
done:   mv   a0, t0
        ret
