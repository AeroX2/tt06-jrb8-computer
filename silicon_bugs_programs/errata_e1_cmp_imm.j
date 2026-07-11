// ============================================================================
// hardware-errata.md  E1 — `cmp reg, immediate` does not latch the flags
// ----------------------------------------------------------------------------
// `cmp a 0` (and cmp with 1/-1/255) is a no-op on silicon: it never asserts the
// flag write-enable, so a following conditional jump reads the flags left by the
// most recent flag-setting op instead.
//
// Here the zero flag is deliberately pre-set to 1 (via `opp b` with b = 0) while
// a = 5. A `cmp a 0` on a working machine would clear it (5 != 0); on silicon it
// leaves the stale zero flag alone, so `jmp =` is (wrongly) taken.
//
//   Buggy silicon (and this VM):  `jmp =` taken     -> out = 0xE1  (225)
//   A "correct" machine:          `jmp =` NOT taken -> out = 0
//
// Flash + run, then read uo_out: 0xE1 confirms E1.
// ============================================================================
load rom a 5
load rom b 0
opp b            // zero flag = (b == 0) = 1 ; a stays 5
cmp a 0          // correct machine: a != 0 -> zero flag = 0 ; silicon: no-op
jmp = bug        // taken iff zero flag still set
out 0            // cmp latched -> not taken -> out 0
halt
:bug
out 0xE1         // cmp was a no-op -> stale zero flag -> out 0xE1
halt
