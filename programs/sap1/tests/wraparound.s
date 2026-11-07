; 8-bit arithmetic wraps: 3 - 5 = 0xfe, then + 0xff = 0xfd
; expect outputs=0xfe,0xfd a=0xfd b=0xff halt=hlt
        LDA three
        SUB five
        OUT
        ADD big
        OUT
        HLT
three:  .byte 3
five:   .byte 5
big:    .byte 0xff
