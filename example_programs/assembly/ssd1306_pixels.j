// ============================================================
//  SSD1306 OLED "draw some pixels" demo for the JRB8 computer
// ============================================================
//
//  Bit-banged I2C on the output register:
//     SDA (data)  = uo[0]   <- output bit 0
//     SCL (clock) = uo[1]   <- output bit 1
//
//  Every `out N` drives all 8 output pins and holds them until
//  the next `out`.  We only use the low two bits:
//
//     out value = (SCL << 1) | SDA
//        0b00 = 0 : SDA=0 SCL=0
//        0b01 = 1 : SDA=1 SCL=0
//        0b10 = 2 : SDA=0 SCL=1
//        0b11 = 3 : SDA=1 SCL=1
//
//  I2C address 0x78 = 0x3C write.  (Use 0x7A if your panel is 0x3D.)
//  We can only drive the pins (no read-back), so the 9th ACK clock
//  is generated but the ACK bit is ignored - fine for a demo.
//
//  RAM layout (page 0):
//     ram[0..32]  = command byte table (see below)
//     ram[252]    = column counter (data phase)
//     ram[253]    = page counter   (data phase)
//     ram[254]    = command-table index
//
//  Register use during the send loops:
//     b = byte being sent     d = return tag
//     a = ALU scratch         c = mask / loop counter (clobbered by sendbyte)
// ============================================================


// ---------- Build the command table in RAM[0..32] ----------
// [0] slave address, [1] command control byte, [2..] init + window
load rom a 0x78
save a ram[0]      // I2C write address (0x3C<<1)
load rom a 0x00
save a ram[1]      // control byte: Co=0 D/C#=0 -> command stream
load rom a 0xAE
save a ram[2]      // display OFF
load rom a 0xD5
save a ram[3]      // set display clock divide
load rom a 0x80
save a ram[4]      //   ratio/oscillator
load rom a 0xA8
save a ram[5]      // set multiplex ratio
load rom a 0x3F
save a ram[6]      //   63 (for 128x64)
load rom a 0xD3
save a ram[7]      // set display offset
load rom a 0x00
save a ram[8]      //   0
load rom a 0x40
save a ram[9]      // set start line 0
load rom a 0x8D
save a ram[10]     // charge pump
load rom a 0x14
save a ram[11]     //   enable
load rom a 0x20
save a ram[12]     // memory addressing mode
load rom a 0x00
save a ram[13]     //   horizontal
load rom a 0xA1
save a ram[14]     // segment remap
load rom a 0xC8
save a ram[15]     // COM scan direction remapped
load rom a 0xDA
save a ram[16]     // COM pins config
load rom a 0x12
save a ram[17]     //   alternative
load rom a 0x81
save a ram[18]     // contrast
load rom a 0xCF
save a ram[19]     //   value
load rom a 0xD9
save a ram[20]     // pre-charge period
load rom a 0xF1
save a ram[21]     //   value
load rom a 0xDB
save a ram[22]     // VCOMH deselect
load rom a 0x40
save a ram[23]     //   value
load rom a 0xA4
save a ram[24]     // resume to RAM content
load rom a 0xA6
save a ram[25]     // normal (non-inverted)
load rom a 0x21
save a ram[26]     // set column address range
load rom a 0x00
save a ram[27]     //   start col 0
load rom a 0x7F
save a ram[28]     //   end col 127
load rom a 0x22
save a ram[29]     // set page address range
load rom a 0x00
save a ram[30]     //   start page 0
load rom a 0x07
save a ram[31]     //   end page 7
load rom a 0xAF
save a ram[32]     // display ON


// ---------- Send the command transaction ----------
// I2C START
out 0b11
out 0b10
out 0b00
// walk ram[0..32], sending each byte
load rom a 0
save a ram[254]        // index = 0
:cmd_loop
load ram[254] c        // c = index
load ram[c] b          // b = table[index]
load rom d 0           // return tag 0
jmp sendbyte
:ret0
load ram[254] c        // reload index (sendbyte clobbered c)
opp c+1                // a = index + 1
mov a c                // c = index + 1
save c ram[254]        // store next index
load rom b 33          // b = table length
cmp c b
jmp < cmd_loop         // continue while index < 33
// I2C STOP
out 0b00
out 0b10
out 0b11


// ---------- Send the pixel data transaction ----------
// I2C START
out 0b11
out 0b10
out 0b00
// slave address 0x78
load rom b 0x78
load rom d 1
jmp sendbyte
:ret1
// data control byte 0x40 (Co=0, D/C#=1 -> data stream)
load rom b 0x40
load rom d 2
jmp sendbyte
:ret2
// fill the whole frame: 8 pages x 128 columns = 1024 bytes
load rom a 8
save a ram[253]        // page counter = 8
:data_page
load rom a 128
save a ram[252]        // column counter = 128
:data_col
load rom b 0xFF        // pixel byte: 0xFF = 8 vertical pixels ON
load rom d 3           //   (change this constant to draw a pattern)
jmp sendbyte
:ret3
load ram[252] c        // reload column counter
opp c-1               // a = col - 1
mov a c
save c ram[252]
cmp c 0
jmp != data_col        // next column
load ram[253] c        // reload page counter
opp c-1
mov a c
save c ram[253]
cmp c 0
jmp != data_page       // next page
// I2C STOP
out 0b00
out 0b10
out 0b11
halt


// ============================================================
//  sendbyte  -  transmit register b over I2C, MSB first
//               d holds a return tag, dispatched at the end.
//               clobbers a and c; preserves b and d.
// ============================================================
:sendbyte
load rom c 0b10000000   // mask = bit 7
:sb_bitloop
mov b a                 // a = data
opp a&c                 // a = data & mask
cmp a 0
jmp = sb_send0
// ---- send a 1 bit ----
out 0b01                // SDA=1, SCL=0
out 0b11                // SDA=1, SCL=1  (clock rising edge)
out 0b01                // SDA=1, SCL=0
jmp sb_next
:sb_send0
// ---- send a 0 bit ----
out 0b00                // SDA=0, SCL=0
out 0b10                // SDA=0, SCL=1  (clock rising edge)
out 0b00                // SDA=0, SCL=0
:sb_next
load rom a 2
opp c/a                // a = mask / 2
mov a c                 // mask >>= 1
cmp c 0
jmp != sb_bitloop       // 8 bits total
// ---- 9th clock: ACK (SDA released high, bit ignored) ----
out 0b01
out 0b11
out 0b01
// ---- return to caller based on tag in d ----
cmp d 0
jmp = ret0
load rom a 1
cmp d a
jmp = ret1
load rom a 2
cmp d a
jmp = ret2
load rom a 3
cmp d a
jmp = ret3
halt                    // unreachable
