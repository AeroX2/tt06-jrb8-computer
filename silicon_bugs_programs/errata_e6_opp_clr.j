// ============================================================================
// hardware-errata.md  E6 — `opp clr` is a no-op
// ----------------------------------------------------------------------------
// `opp clr` is specified to clear the comparison flags, but its CU control word
// is 0, so the ALU is never started and the flag latch never fires. The flags
// (and carry/sign mode) are left completely unchanged.
//
// Set the zero flag with `cmp a a`, then `opp clr`; a working machine would
// clear it, silicon leaves it set, so `jmp =` is still taken.
//
//   Buggy silicon (and this VM):  `jmp =` taken     -> out = 0xE6  (230)
//   A "correct" machine:          `jmp =` NOT taken -> out = 0
// ============================================================================
load rom a 5
cmp a a          // a == a -> zero flag = 1 (cmp reg,reg latches)
opp clr          // silicon: no-op, zero flag stays 1
jmp = bug        // taken iff zero flag still set
out 0            // opp clr worked -> not taken -> out 0
halt
:bug
out 0xE6         // opp clr did nothing -> stale zero flag -> out 0xE6
halt
