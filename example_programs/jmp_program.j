jmp start
:end
out a
pause
:start
load rom a 1
load rom b 1
opp a+b
jmp one 
:two
mov a b
load rom a 11
opp a-b
jmp end
:one
load rom b 3
opp a+b
jmp two
