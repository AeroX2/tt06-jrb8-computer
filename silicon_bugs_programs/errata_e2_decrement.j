// ============================================================================
// hardware-errata.md  E2 — decrement-loop off-by-one
// ----------------------------------------------------------------------------
// `opp c-1` latches the zero flag from the PRE-inversion intermediate (-c), i.e.
// from the value of c BEFORE the decrement, not from the result (c-1). So a
// countdown loop `opp c-1 ; cmp c 0 ; jmp != loop` keeps looping until the
// PRE-decrement value is 0 -> it runs one extra iteration and the counter
// underflows to 0xFF instead of stopping at 0x00.
//
//   Buggy silicon (and this VM):  out = 255  (0xFF)
//   A "correct" machine:          out = 0
//
// Flash + run, then read uo_out: 0xFF confirms E2.
// ============================================================================
load rom c 3
:loop
opp c-1
cmp c 0
jmp != loop
out c
halt
