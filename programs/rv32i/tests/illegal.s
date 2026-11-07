# An illegal instruction halts the core; it does not count as retired, and
# the instruction after it never runs.
# expect a0=1 a1=0
        li   a0, 1
        .word 0xffffffff
        li   a1, 2
