; Unused opcodes (3..13) do nothing. Code and data share one RAM, so an
; instruction byte can be loaded as data.
; expect outputs=0,0xe0 a=0xe0 halt=hlt
        LDA 0          ; a = mem[0] = 0x00, this instruction's own encoding
        .byte 0x3f     ; opcode 3: no operation
here:   OUT            ; outputs 0x00; encoded as 0xe0
        LDA here       ; a = 0xe0, the OUT instruction above
        OUT
        HLT
