# No ecall: the core runs into zero-filled memory (0x00000000 is illegal) and halts.
# expect a0=7
        li   a0, 7
