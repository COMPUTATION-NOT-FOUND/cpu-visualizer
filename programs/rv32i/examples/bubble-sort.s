# Bubble sort of eight signed words, in place.
# expect m[0]=-7 m[4]=0 m[8]=3 m[0xc]=5 m[0x10]=9 m[0x14]=12 m[0x18]=21 m[0x1c]=40
        .data
array:  .word 12, -7, 40, 3, 9, 0, 21, 5
        .text
        la   a0, array
        li   a1, 8           # length
outer:  addi a1, a1, -1      # last index of the unsorted part
        blez a1, done
        mv   t0, a0          # pointer
        mv   t1, a1          # comparisons left
inner:  lw   t2, 0(t0)
        lw   t3, 4(t0)       # load-use on the next instruction
        ble  t2, t3, noswap
        sw   t3, 0(t0)
        sw   t2, 4(t0)
noswap: addi t0, t0, 4
        addi t1, t1, -1
        bnez t1, inner
        j    outer
done:   ecall
