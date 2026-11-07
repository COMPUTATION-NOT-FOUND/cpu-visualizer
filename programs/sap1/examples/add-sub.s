; Malvino's first SAP-1 program: 16 + 20 + 24 - 4 = 56
; expect a=56 out=56 outputs=56 halt=hlt
        LDA x
        ADD y
        ADD z
        SUB w
        OUT
        HLT
        .org 9
x:      .byte 16
y:      .byte 20
z:      .byte 24
w:      .byte 4
