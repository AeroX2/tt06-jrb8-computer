// ============================================================================
// hardware-errata.md  E3 — carry mode leaks into a plain subtraction
// ----------------------------------------------------------------------------
// Once carry mode is enabled, the carry flag is folded into EVERY adder-path op,
// not just add-with-carry. Here an overflowing add sets the carry flag, then a
// following `opp a-b` (50 - 50) folds that stray carry in and computes 1.
//
//   Buggy silicon (and this VM):  out = 1
//   A "correct" machine:          out = 0
//
// Flash + run, then read uo_out: 0x01 confirms E3.
// (Turn carry mode off with `opp carry off` before non-add ops to avoid this.)
// ============================================================================
opp carry on
load rom a 200
load rom b 100
opp a+b          // a = 44, carry flag set
load rom a 50
load rom b 50
opp a-b          // silicon: 50 - 50 + carry(1) = 1
out a
halt
