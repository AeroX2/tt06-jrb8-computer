// ============================================================================
// hardware-errata.md  E7 — indexed RAM access clobbers the MAR
// ----------------------------------------------------------------------------
// `save a mar` sets the memory address register, but the only RAM address path
// is {mpage, mar}, so any register/immediate-indexed RAM access must route its
// index through MAR -- overwriting it. A later `save X ram[current]` then writes
// to the wrong address.
//
// Here mar is set to 42, then `load ram[b] c` (b=7) silently sets mar=7, so
// `save d ram[current]` writes 99 to ram[7] instead of ram[42].
//
//   Buggy silicon (and this VM):  out = 0, 99   (ram[42] untouched, ram[7]=99)
//   A "correct" machine:          out = 99, 0   (ram[42]=99, ram[7] untouched)
//
// NOTE: needs writable RAM (PSRAM); RAM writes are dropped on the stock QSPI Pmod.
// ============================================================================
load rom a 42
save a mar          // mar = 42
load rom b 7
load ram[b] c       // register-indexed read -> silently clobbers mar to 7
load rom d 99
save d ram[current] // writes 99 to ram[mar]: silicon ram[7], intended ram[42]
load ram[42] a
out a               // silicon: 0 (ram[42] never written)
load ram[7] a
out a               // silicon: 99 (ram[7] got the write)
halt
