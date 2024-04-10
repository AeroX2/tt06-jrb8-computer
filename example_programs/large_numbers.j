opp cmp on

// Large addition
// = 1234 + 4567
// = 0b10011010010 + 0b1000111010111
// = (0b100 + 0b10001) << 8 + (0b11010010 + 0b11010111)
// = (4 + 17) << 8 + (210 + 215)

load rom a 210
load rom b 215
opp a+b
out a // 0 but carry is set
load rom a 17
load rom b 4
opp a+b
out a // 27

// Large subtraction
// TODO

// Large multiplication
// = 1234 * 5678
// = (12 * 100 + 34) * (56 * 100 + 78)
// = (12*100*56*100 + 34*56*100 + 12*100*78 + 34*78)
// = 0b10011010010 * 0b1011000101110
// = (0b100 << 8 + 0b11010010 ) + (0b10110 << 8 * 0b00101110)
// = 0b100<<8*0b10110<<8 + 0b11010010*0b10110<<8 + 0b100<<8*0b00101110 + 0b11010010*0b00101110
// = (4<<8)*(22<<8) + 210*(22<<8) + (4<<8)*46 + 210*46

load rom c 0
save c ram[0]
save c ram[1]
save c ram[2]
save c ram[3]

save c ram[4]
save c ram[5]
save c ram[6]
save c ram[7]

save c ram[8]
save c ram[9]
save c ram[10]
save c ram[11]

save c ram[12]
save c ram[13]
save c ram[14]
save c ram[15]

load rom a 210
load rom b 46
opp a*b
save a ram[3]
load rom a 210
opp a.*b
save a ram[2]

load rom a 4
load rom b 46
opp a*b
save a ram[6] // 1*4+2
load rom a 4
opp a.*b
save a ram[5] // 1*4+1

load rom a 210
load rom b 22
opp a*b
save a ram[10] // 2*4+2
load rom a 210
opp a.*b
save a ram[9] // 2*4+1

load rom a 4
load rom b 22
opp a*b
save a ram[13] // 3*4+1
load rom a 4
opp a.*b
save a ram[12] // 3*4+0

// First 8 bits
load ram[3] a
load ram[7] b
opp a+b
save a ram[3]
load ram[2] b
opp b
save b ram[2]

load ram[3] a
load ram[11] b
opp a+b
save a ram[3]
load ram[2] b
opp b
save b ram[2]

load ram[3] a
load ram[15] b
opp a+b
save a ram[3]
load ram[2] b
opp b
save b ram[2]

// Second 8 bits
load ram[2] a
load ram[6] b
opp a+b
save a ram[2]
load ram[1] b
opp b
save b ram[1]

load ram[2] a
load ram[10] b
opp a+b
save a ram[2]
load ram[1] b
opp b
save b ram[1]

load ram[2] a
load ram[14] b
opp a+b
save a ram[2]
load ram[1] b
opp b
save b ram[1]

// Third 8 bits
load ram[1] a
load ram[5] b
opp a+b
save a ram[1]
load ram[0] b
opp b
save b ram[0]


load ram[1] a
load ram[9] b
opp a+b
save a ram[1]
load ram[0] b
opp b
save b ram[0]

load ram[1] a
load ram[13] b
opp a+b
save a ram[1]
load ram[0] b
opp b
save b ram[0]

// Last 8 bits
load ram[0] a
load ram[4] b
opp a+b
save a ram[0]

load ram[0] a
load ram[8] b
opp a+b
save a ram[0]

load ram[0] a
load ram[12] b
opp a+b
save a ram[0]

load ram[3] a
out a
load ram[2] a
out a
load ram[1] a
out a
load ram[0] a
out a

pause

