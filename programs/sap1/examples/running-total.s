; Shows each partial sum on the output register: 5, 15, 30, 50
; expect outputs=5,15,30,50 a=50 halt=hlt
        LDA n1
        OUT
        ADD n2
        OUT
        ADD n3
        OUT
        ADD n4
        OUT
        HLT
n1:     .byte 5
n2:     .byte 10
n3:     .byte 15
n4:     .byte 20
