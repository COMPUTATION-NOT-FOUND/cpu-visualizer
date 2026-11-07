; Without HLT the PC wraps from 15 to 0 and the program runs forever.
; The checker stops after 600 T-states.
; expect halt=timeout
        LDA one
        ADD one
        OUT
one:    .byte 1
