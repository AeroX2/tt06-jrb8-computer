load rom a 53
load rom b 7
load rom c 0

:loop1
opp a-b
jmp .<= loop1exit

mov c b
opp b+1
mov b c

load rom b 7
jmp loop1

:loop1exit
opp a+b

out a
out c
pause

// a = a % b
// c = a / b
