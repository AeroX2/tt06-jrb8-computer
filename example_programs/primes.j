load rom c 2

:start
load rom b 2

:startdivide
mov c a
:divide
opp a-b
cmp a 0
jmp = nextprime
jmp .> divide

opp b+1
cmp b c
jmp >= printprime
jmp startdivide

:printprime
out c

:nextprime
opp c+1

jmp start

