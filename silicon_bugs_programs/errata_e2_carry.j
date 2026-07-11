// ============================================================================
// hardware-errata.md  E2 (carry facet) — `opp a-1` latches an inverted borrow
// ----------------------------------------------------------------------------
// `opp a-1` is built as negate-then-invert; the carry flag reads the negate's
// borrow and never sees the inversion, so it latches carry = (operand != 0) --
// the inverse of the true decrement borrow (which should be set only at 0).
//
// a = 5; `opp a-1` -> result 4 (no real borrow), but carry is set. `jmp <`
// reads the carry flag.
//
//   Buggy silicon (and this VM):  carry set -> `jmp <` taken -> out = 0xCA (202)
//   A "correct" machine:          carry clear (4 didn't borrow) -> out = 0
// ============================================================================
load rom a 5
opp a-1          // result 4; silicon: cflag = (5 != 0) = 1
jmp < bug        // jmp < reads the carry flag; taken iff carry set
out 0            // correct: 5-1=4 did not borrow -> not taken -> out 0
halt
:bug
out 0xCA         // silicon: stray inverted borrow -> out 0xCA
halt
