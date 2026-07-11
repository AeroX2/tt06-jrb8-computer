// ============================================================================
// hardware-errata.md  E2 — output-inverting op latches Z/S from the pre-value
// ----------------------------------------------------------------------------
// `opp ~a` with a = 0xFF produces 0x00, so a "correct" machine would set the
// zero flag. On silicon the flags are latched from the PRE-inversion
// intermediate (0xFF), so the zero flag stays CLEAR even though the result is 0.
//
//   Buggy silicon (and this VM):  `jmp =` NOT taken -> out = 0xE2  (226)
//   A "correct" machine:          `jmp =` taken     -> out = 0
//
// Flash + run, then read uo_out: 0xE2 confirms E2.
// ============================================================================
load rom a 255
opp ~a
cmp a 0
jmp = correct
out 0xE2
halt
:correct
out 0
halt
