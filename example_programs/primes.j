load rom c 1

:start
load rom b 2

:startdivide
mov c a
:divide
opp a-b
jmp = nextprime
jmp .> divide

opp b+1
mov a b
cmp a c
jmp >= printprime
jmp startdivide

:printprime
out c

:nextprime
mov c a
opp a+1
mov a c

jmp start

