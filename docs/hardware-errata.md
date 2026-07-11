# Hardware errata

Known bugs in the manufactured JRB8 silicon, with software workarounds.

## E1 — `cmp reg, immediate` does not update the flags

### Summary

The compare-to-constant instructions

| opcode | instruction |
| --- | --- |
| `0x10`–`0x13` | `cmp {a,b,c,d} 0` |
| `0x14`–`0x17` | `cmp {a,b,c,d} 1` |
| `0x18`–`0x1B` | `cmp {a,b,c,d} -1` |
| `0x1C`–`0x1F` | `cmp {a,b,c,d} 255` |

**do not latch the comparison flags** (zero / overflow / carry / sign). The
register-to-register compares (`cmp X Y`, `0x20`–`0x2F`) and **every** ALU `opp`
instruction *do* update the flags.

### Root cause

The flag write-enable is, in `src/alu.sv`:

```verilog
assign cmpo = (cmp || cins == CLR_CMP_INS) && state == INVERT;   // cmp.we
wire cmp = val[7];                                               // per-instruction
```

`val` is the ALU control word from `rom/alu_rom.mem` (built from
`rom/alu_flags.csv` by `rom/flags_parse.py`). The `CMP` column is set (`x`) for
`0x20`–`0x2F` and for every `opp`, but **left blank for `0x10`–`0x1F`**. So for
`cmp reg, imm`, `val[7] = 0`, `cmpo` never asserts, and `cmp.sv` never latches:

```
0x10 cmp a 0    val=0x02C   CMP0  -> no latch
0x14 cmp a 1    val=0x00C   CMP0  -> no latch
0x20 cmp a a    val=0x0A8   CMP1  -> latches
0x6A opp c-1    val=0x0B6   CMP1  -> latches
0xB0 opp a&b    val=0x180   CMP1  -> latches
```

This is almost certainly an oversight — the constant compares were meant to
latch just like the register compares.

### Consequence

A conditional jump after `cmp reg, imm` reads the flags left by the **most
recent flag-setting instruction** (the last `opp` or `cmp reg, reg`), not the
comparison you wrote. It only *appears* to work when that preceding instruction
happened to leave the flag you test at the value you wanted:

- **Works by accident:** `opp c-1` ; `cmp c 0` ; `jmp !=` — the `jmp` reads
  `opp c-1`'s zero flag (the `cmp c 0` is a no-op). **Caveat — see E2:** that
  zero flag is actually set from the value of `c` *before* the decrement, not
  from `c-1`, so a countdown loop runs one iteration too many and the counter
  underflows to `0xFF` instead of stopping at `0`. It still produces correct
  output for the SSD1306 examples only because they write a *uniform* fill byte,
  so the one extra write is harmless.
- **Breaks:** `cmp b 0` ; `jmp .<` where the op before was `opp a+b` (a left
  shift) — `jmp .<` reads the *shift's* sign/overflow, not `b < 0`. This
  corrupted the SSD1306 bit serializer (`send_reg_b`, sign-flag variant) and
  produced garbled output on a real panel.

### Why it wasn't caught in simulation

The TypeScript `HardwareVM` (`compiler/src/vm/hardware_vm.ts`) originally latched
the flags for *all* `cmp` variants — it didn't model the `CMP` control bit. So a
program using `cmp reg, imm; jmp <cond>` verified correctly in the VM but failed
on silicon. The VM now models the quirk (`executeCompare` treats `0x10`–`0x1F`
as a no-op), so it matches the hardware and catches this class of bug.

### Workaround

Never rely on `cmp reg, imm` to set the flags. Instead:

1. **Use an `opp` to set the flags** (all `opp`s latch). `opp <reg>` is identity
   — it leaves the register unchanged but sets zero/sign/overflow from it:
   - `opp a` then `jmp =` / `jmp !=` tests `a == 0` / `a != 0`.
   - `opp a` then `jmp .<` tests `a < 0` (signed), i.e. bit 7.
   - To test a single bit, `load rom a <mask>` ; `opp a&b` ; `cmp a 0` (no-op) ;
     `jmp =` — `opp a&b` sets the zero flag, and the jump reads it. This is how
     the SSD1306 examples serialize a byte.
2. **Or put the constant in a register and use `cmp reg, reg`** (which latches).

The generated SSD1306 programs (`example_programs/assembly/*_gen.py`) use the
AND-mask form above.

Confirm on hardware with `silicon_bugs_programs/errata_e1_cmp_imm.j`
(outputs `0xE1`, would be `0x00` on a machine where `cmp reg, imm` latched).

### Fix for a future respin

In `rom/alu_flags.csv`, set the `CMP` column (`x`) for rows `CMP-0x10` …
`CMP-0x1F`, then regenerate and re-harden:

```bash
python rom/flags_parse.py        # rewrites rom/alu_rom.mem
```

## E2 — output-inverting `opp` ops latch the flags one datapath stage too early

### Summary

The ALU ops whose final step is a bitwise inversion of the result —

| opcode | instruction |
| --- | --- |
| `0x57` | `opp -1` |
| `0x5C`–`0x5F` | `opp ~a` … `opp ~d` |
| `0x68`–`0x6B` | `opp a-1` … `opp d-1` |
| `0xB6`–`0xBB` | `opp a\|b` … `opp c\|d` |

write the **correct value to the destination register**, but latch the **zero,
sign and overflow flags from the *pre-inversion* intermediate**, not from the
final (inverted) result. The two differ by a bitwise NOT, so:

- `opp c-1` sets the zero flag from `-c`, i.e. `zflag = (c == 0)` — the value
  **before** the decrement, not `(c - 1 == 0)`.
- `opp ~a` sets `zflag = (a == 0)` (should be `a == 0xFF`) and `sflag = a[7]`
  (should be `~a[7]`).
- `opp a|b` sets its flags from `~a & ~b`.

### Root cause

`opp` results are computed in two registered stages: a SUM/AND/MULT/DIV stage,
then an INVERT stage (`src/alu.sv`):

```verilog
INVERT: begin
  muxoutput <= muxoutput ^ {8{io}};   // final result appears NEXT cycle
end
```

but the flag write-enable fires **during** the `INVERT` state, before that
assignment takes effect:

```verilog
assign cmpo = (cmp || cins == CLR_CMP_INS) && state == INVERT;
```

So `cmp.sv` samples `databus` (= `aluout` = the *un-inverted* `muxoutput`) and
latches zero/sign from it. The register write happens later, when `muxoutput`
holds the inverted value — so the register is right and the flags describe the
intermediate. `io` (the invert bit, `val[4]`) is set for exactly the opcodes
above.

### Consequence

A conditional branch that depends on one of these ops reads a flag that is the
bitwise complement of what the result implies. The common victim is the
canonical countdown loop:

```
load rom c 16
:fill
  ... body ...
  opp c-1
  cmp c 0          ; no-op (E1)
  jmp != fill
```

`jmp !=` loops while `zflag == 0`, i.e. while the **pre-decrement** `c != 0`, so
the body runs **17** times (`c` = 16…1, then 0 → wraps to `0xFF` and exits), not
16. This is the caveat noted under E1: it went unnoticed because the SSD1306
programs write a uniform fill, where an extra identical byte is harmless.

### Why it wasn't caught in simulation

The TypeScript `HardwareVM` computed each op's flags from the final result. The
existing cocotb tests (`test/test_alu.py`) only check `aluout` (the result), and
`test/test_cmp.py` exercises the `cmp` module in isolation — nothing asserts the
flags latched after an `opp`, so the pre-inversion latch was invisible. The VM
now models it (`isOutputInverting` → flags from `(~result) & 0xFF`).

### Workaround

- **Do not branch on the zero/sign flag of an inverting op.** To test a value,
  put it in a register with a *non*-inverting op and branch on that: `opp a`
  (identity, `0x58`) or `cmp reg, reg` set the flags from the real value.
- For a countdown that must stop at 0, either compare against a register
  (`load rom d 0` ; `cmp c d` ; `jmp =`) or accept/account for the extra
  iteration (`0xFF` terminator).

Confirm on hardware with `silicon_bugs_programs/errata_e2_decrement.j`
(outputs `0xFF`, would be `0x00` on a correct machine) and
`errata_e2_not.j` (outputs `0xE2`, would be `0x00`).

### Facet — the carry flag is *also* wrong for `opp a-1`…`d-1` (and inverted)

E2 above is about Z/S/O, which are sampled from the databus. The **carry** flag takes
a *separate* path (`carryout`, `src/alu.sv:193`) and is wrong for the decrements in a
different way. `opp x-1` is built as a negate-then-invert (`alu_rom[0x68..0x6B]=0xB6`:
the SUM stage computes `~x + 1 = 256 − x`, then `io=1` inverts it to `x − 1`). But
`carryout` reads the negate's borrow and never sees the inversion: with `(ia|ib)&po = 1`,
`carryout = !full_sum[8] = !(x==0) = (x != 0)`. So after `opp x-1` the carry flag is set
for **every** operand except 0 — the arithmetic **inverse** of the true decrement borrow
(which should be set only when `x==0` wraps `0→0xFF`). E2's "latch after INVERT" fix would
not help, because `carryout` is derived from the never-inverted `full_sum`. Genuine
subtraction `opp a-b` (`0x78`, `io=0`) sets carry correctly (`= a<b`); only `0x68`–`0x6B`
invert it. Impact is low — decrement loops idiomatically test zero, not carry — but a
`jmp c` after `opp x-1` reads a carry unrelated to (and inverted from) the result.

### Fix for a future respin

Latch the flags one cycle later (in the `IDLE`/return edge after `INVERT`), or
compute the flag source from the post-inversion `muxoutput ^ {8{io}}` inside the
`cmpo` window.

## E3 — carry mode leaks into every adder-path op, not just add-with-carry

### Summary

`opp carry on` (`0x52`) is meant to enable a carry-in for multi-byte
`add-with-carry`. But the carry is injected into **every** adder-path (`cselect
== 0`) op — constants, identity, `~`, negate, increment, decrement, subtract and
`cmp reg, reg` — for as long as carry mode is on. So with carry mode enabled and
the carry flag set:

- `opp a` returns `a + 1` (identity is no longer identity),
- `opp a-b` returns `a - b + 1`,
- `cmp a b` with `a == b` reports **not equal**.

### Root cause

`src/alu.sv` adds the carry term to `full_sum` for any op with the `CMP` control
bit (all `opp` + `cmp reg, reg`), gated only by `carry_mode`:

```verilog
full_sum = xora + xorb + {8'b0, po} +
           {8'b0, (carry_mode && cmp) ? carried : 1'b0};   // carried = carry_mode & carryin
```

There is no term restricting this to the add opcodes, so subtraction, compare
and even identity pick up the carry. (`opp b` used as "add the carry to the high
byte" in `large_numbers.j` relies on exactly this behaviour — it is a feature
there and a footgun everywhere else.)

### Consequence

Any code that leaves carry mode on across a compare or subtract can get a silent
off-by-one. It only bites when the carry flag happens to be set, so it is
intermittent and easy to misdiagnose.

### Workaround

Treat carry mode as strictly scoped: `opp carry on`, do the add-with-carry
chain, then `opp carry off` before any compare/subtract/identity. The VM models
the contamination, so VM-verified code that violates this will now diverge and
surface it. Confirm on hardware with
`silicon_bugs_programs/errata_e3_carry.j` (outputs `0x01`, would be `0x00`).

### Fix for a future respin

Gate the carry term on the add opcodes only (e.g. a dedicated control-word bit
set for `0x6C`–`0x77`), instead of on `carry_mode && cmp`.

## E4 — `jmpr` fetches **two** operand bytes; the 8-bit offset lands in the high byte

> **Correction (2026-07):** the original E4 (below the line) was wrong about the
> mechanism. A ROM-level audit shows `jmpr`'s control words are byte-identical to
> the 16-bit *absolute* jumps, so `jmpr` runs a **two-operand-byte fetch** and the
> intended offset byte ends up in the **high** half of the displacement (×256),
> not merely "un-sign-extended".

### Summary

The CU microcode for the relative jumps `jmpr` (`0x40`–`0x4E`) was copied from the
absolute-jump family. `rom/cu_rom.mem[0x40..0x4E] = 8` and `rom/cu_rom_2.mem[0x40..0x4A]
= 0x0E` decode (via `cu_flag_conv`) to the same stage‑1/stage‑2 words as `jmp {label}`
— `ROMO+PCC` then `ROMO+JMPO+PCC` — so the CU fetches **two** ROM operand bytes and
`src/jmp.sv:66` builds a 16-bit `two_byte_address = {highbits, databus}`. But the
assembler and reference VM treat `jmpr` as a **2-byte** instruction with a single
signed 8-bit offset (`compiler/src/vm/hardware_vm.ts` `executeJumpRelative`). The
result, per opcode block:

| opcodes | stage-2 `PCC` | effect on a taken `jmpr` |
| --- | --- | --- |
| `0x40`–`0x4A` (`jmpr`, `jmpr =/!=/</<=/>/>=/.<..`) | **set** | offset byte → high byte (×256); the **next instruction's opcode** is consumed as the low byte; **3 bytes** total, so even a *not-taken* conditional `jmpr` desyncs the stream (falls through to PC+3). |
| `0x4B`–`0x4E` (`jmpr z/o/c/s`) | **clear** | stage‑2 re-reads the same byte, so displacement = `{N,N}` = `N×0x0101`; 2 bytes consumed. |

`0x40` additionally has `val[4]=0` in `rom/jmp_rom.mem` (acts absolute), the one fact
the original E4 got right.

### Root cause

`jmpr` needs its **own** single-operand-byte microcode (drop the stage-2 ROM fetch);
instead it inherited the absolute jump's two-fetch sequence.

### Status

**Latent.** Both assemblers and the JRP compiler emit absolute `jmp`, never `jmpr`,
so no shipped program is affected. The TypeScript assembler now **rejects** `jmpr`
with an error pointing to absolute `jmp`. Prefer absolute `jmp`.

### Fix for a future respin

Give `0x40`–`0x4E` a distinct stage‑1 CU word that fetches **one** operand byte into
the low half and sign-extends it into `two_byte_address[15:8]` (do **not** "sign-extend
into `highbits`" as the original note said — `highbits` already wrongly holds the
offset), and set `rom/jmp_rom.mem[0x40]` `val[4]=1`.

<details><summary>Original (incorrect) E4 text, kept for history</summary>

> `rom/jmp_rom.mem[0x40]` has its relative bit (`val[4]`) clear so it behaves as an
> absolute jump; and the relative datapath never sign-extends the 1-byte offset. —
> This under-described the bug: it is a two-operand-byte fetch, not a sign-extension
> miss. See the correction above.

</details>

## E5 — `jmp z/o/c/s {number}` (`0x3B`–`0x3E`) jump to `{N,N}`, not the operand address

### Summary

The flag-test absolute jumps `jmp z/o/c/s` are 2-byte instructions (opcode + one
operand byte, per both assemblers). Their **stage-2** CU control word omits `PCC`:
`rom/cu_rom_2.mem[0x3B..0x3E] = 0x57` → `cu_flag_conv = 0x000A00` (`ROMO+JMPO`,
`PCC` **clear**), whereas the working 3-byte siblings `jmp =/!=/<..` (`0x31`–`0x3A`)
use `0x0E` → `0x100A00` (`+PCC`). With `PCC` clear the PC does not advance for the
second ROM read (`src/cu.sv:88` only bumps PC when `pcc`), so stage 2 re-reads the
**same** operand byte `N` that stage 1 already latched into `highbits`
(`src/jmp.sv:63`). `src/jmp.sv:66` then forms `two_byte_address = {N, N}`, and
`rom/jmp_rom.mem[0x3B..0x3E]` have `val[4]=0` (absolute), so the taken target is
`{N,N} = N×0x0101`.

The PC accounting is otherwise correct — a *not-taken* `jmp z/o/c/s` falls through
to PC+2, matching the 2-byte encoding — so the defect is invisible until the branch
is **taken**.

### Consequence

- `opp a+b` (A=B=127 → O=1) ; `jmp o 0x0B` → jumps to `0x0B0B`, not `0x000B`.
- Reachable targets are limited to `N×0x0101` (`0x0000, 0x0101, …, 0xFFFF`); the low
  address byte can never be set independently of the high byte.
- `jmp o` and `jmp s` are the **only** instructions that branch on the raw overflow
  and sign flags, and there is no working substitute for them.

### Status

**Latent in shipped code.** No compiler or program emits `0x3B`–`0x3E`; `jmp z` /
`jmp c` are redundant with the working `jmp =` / `jmp <` `{label}` forms. Reachable
only from hand-written assembly.

### Workaround

Use `jmp =` / `jmp <` (`{label}`, 3-byte, correct) instead of `jmp z` / `jmp c`.
There is no assembly substitute for `jmp o` / `jmp s`. **Tooling:** the TypeScript
assembler now **rejects** `jmp z/o/c/s {number}` with an error pointing to the
alternative, and the VM models the `{N,N}` target (regression:
`compiler/src/tests/silicon_quirks.test.ts`).

### Fix for a future respin

Set the stage-2 `PCC` bit for `rom/cu_flags.csv` rows `JMP-0x3B`…`JMP-0x3E` (mirror
`0x31`–`0x3A`) and make them 3-byte `{label}` jumps, or add a datapath that zeroes
the high half for a genuine 8-bit `{number}` jump.

## E6 — `opp clr` (`0x50`) is a no-op: it never clears the flags or resets carry/sign mode

### Summary

`opp clr` is specified to clear the comparison flags (Z/O/C/S) and is modelled by the
reference VM as a full flag/mode reset. On silicon it does **nothing** but advance the
PC. Two independent reasons:

1. `rom/cu_rom.mem[0x50] = rom/cu_rom_2.mem[0x50] = 0` → both CU stages get flag word
   `0`, so `aluo` (`src/cu.sv:63`) is 0 and the CU **never starts the ALU** (never
   enters `FLAGS_1_ALU`/`FLAGS_2_ALU`). The ALU FSM stays in `IDLE` and never reaches
   `INVERT`, so `cmpo = (cmp || cins==CLR_CMP_INS) && state==INVERT` (`src/alu.sv:190`)
   never asserts and `src/cmp.sv` never latches. The dedicated `cins==CLR_CMP_INS` term
   in `cmpo` (and `alu_rom[0x50]=0x080`, `cmp` bit set) show the latch was *intended* to
   fire, but nothing drives the ALU there.
2. The ALU's `IDLE` snoop (`src/alu.sv:94`–`105`) — which is how the sibling mode ops
   `opp carry on/off` and `opp sign on/off` (`0x51`–`0x54`) actually work — handles only
   `0x51`–`0x54`, **not** `0x50`. So `carry_mode` and `signed_mode` are not reset either.

### Consequence

`cmp a b` ; `opp clr` ; `jmp =` reads the flags left by `cmp a b`, not a cleared state.
`opp carry on` ; `opp clr` leaves carry mode on (compounding E3). Distinct from E1 (E1
runs the ALU with the CMP bit clear; here the ALU is never started at all).

### Status / workaround

Reachable by any program that uses `opp clr` to reset state; VM-verified code passes in
simulation but reads stale flags on silicon (same sim-trap class as E1/E2). Workaround:
don't rely on `opp clr`; set the flags explicitly with a `cmp reg,reg` (which latches)
before a conditional branch. The VM now models `opp clr` as a no-op; confirm on hardware
with `silicon_bugs_programs/errata_e6_opp_clr.j` (outputs `0xE6`, would be `0x00`).

### Fix for a future respin

Either give `0x50` a CU word with `aluo` set so the ALU runs to `INVERT`, or add a
`cins == CLR_CMP_INS` case to the ALU `IDLE` block that clears the flags and resets
`carry_mode`/`signed_mode`.

## E7 — Register/immediate-indexed RAM ops clobber the architectural MAR

### Summary

The only SPI RAM address path is `{8'b1, mpage, mar}` (`src/tt_um_aerox2_jrb8_computer.sv:94`),
so any register- or immediate-indexed RAM access must route its index through `mar`.
Accordingly the CU asserts `MARI` in stage 1 for `load ram[reg]` (`0xC0`–`0xCF`),
`save X ram[reg]` (`0xE8`–`0xEB`), `out ram[reg]` (`0xFA`–`0xFD`) **and** the immediate
forms `load/save/out ram[{number}]` (`0xD4`–`0xD7`, `0xEC`–`0xEF`, `0xF9`). The register
block then does `mar <= databus` (`:61`), overwriting the architectural MAR that
`save X mar` (`0xE0`–`0xE3`) sets and that `save X ram[current]` (`0xE4`–`0xE7`, which uses
`RAMI`, not `MARI`) consumes. The reference VM computes indexed addresses locally and never
writes `this.mar`, so it does not model this.

### Consequence

`save a mar` (mar=5) ; `load ram[b] c` (silently sets mar=b) ; `save d ram[current]` → writes
`ram[b]` instead of `ram[5]`. MAR is reliable only between a `save X mar` and an immediately
following `ram[current]` with **no** intervening indexed/immediate RAM access.

### Status / fix

Low impact (narrow interleaving trigger; RAM writes are dropped on the QSPI-Pmod anyway —
see the RAM caveat in docs/README). Workaround: consume a manually-set MAR immediately,
with no intervening indexed/immediate RAM access (keep `save X mar` adjacent to its
`ram[current]`). The VM now models the clobber; confirm with
`silicon_bugs_programs/errata_e7_mar_clobber.j` (outputs `0,99` vs `99,0`; needs writable
RAM). Respin: don't assert `MARI` on the indexed/immediate forms (latch the address
separately).

## E8 — `cs_ram` (`uio_out[4]`) is not gated by 24-bit mode

### Summary

`src/tt_um_aerox2_jrb8_computer.sv:73` guards `cs_rom` with `address_24bit` so that in
24-bit shared-chip mode `cs_rom` is the single select for both ROM and RAM. Line 74,
`cs_ram = (rami || ramo) ? cs : 1`, has **no** complementary `!address_24bit` term. So in
24-bit mode every RAM data phase drives `cs_ram` active-low **at the same time** as `cs_rom`.

### Consequence

Benign on the shipped/documented wiring (on the TinyTapeout QSPI Pmod `uio[4]`/`cs_ram`
lands on the flash's SD2/IO2/WP# line, a don't-care during `0x03` reads, and RAM writes are
no-ops). But on a board that straps `uio[7]=1` yet keeps ROM and RAM as **two separate chips**,
a RAM read selects both chips at once and both drive `miso` → bus contention. 16-bit mode is
correct.

### Fix for a future respin

`cs_ram = (!address_24bit && (rami || ramo)) ? cs : 1;`
