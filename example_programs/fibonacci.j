:start
load rom a 1
load rom b 0
:repeat
mov a c
opp a+b
jmp < start
out a
mov c b
jmp >= repeat
