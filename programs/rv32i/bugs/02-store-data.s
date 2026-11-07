# Bug 2 (old pipeline): the write-data input of the Execute register was not
# connected, so every store wrote x.
# expect a0=42 m[8]=42
        li   t0, 42
        sw   t0, 8(zero)     # rs2 also needs forwarding from the li
        lw   a0, 8(zero)
        ecall
