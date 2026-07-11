# Silicon-bug confirmation programs

Tiny assembly programs that make the JRB8 hardware quirks observable: each one
produces a distinctive value on the output pins (`uo_out`) under the real
(buggy) silicon, and a *different* value on an idealized/correct machine. Flash
one, run it, and read the output pins.

They double as regression tests: each `.j` has a matching `.e` (expected state)
picked up by the compiler's jest suite (`compiler/src/tests/hardware_assembly.test.ts`),
which asserts the **silicon** value — so the `HardwareVM` is held to the real
chip's behavior. `.o` is the assembled image, ready to flash.

## Errata programs (silicon defects — see [`../docs/hardware-errata.md`](../docs/hardware-errata.md))

| Program | Demonstrates | Silicon output | Correct machine |
| --- | --- | --- | --- |
| `errata_e1_cmp_imm` | E1 — `cmp reg, imm` doesn't latch flags | `0xE1` | `0x00` |
| `errata_e2_decrement` | E2 — decrement loop off-by-one (counter ends `0xFF`) | `0xFF` | `0x00` |
| `errata_e2_not` | E2 — `opp ~a` latches Z/S from the pre-inversion value | `0xE2` | `0x00` |
| `errata_e3_carry` | E3 — carry mode leaks into a plain subtraction | `0x01` | `0x00` |

## VM-fidelity programs (silicon is correct; the VM used to be wrong)

| Program | Demonstrates | Silicon (& fixed VM) | Old VM |
| --- | --- | --- | --- |
| `divzero` | divide-by-zero returns the dividend | `100` | `0` |
| `sign_divide` | signed divide under `opp sign on` (-6 / 2 = -3) | `0xFD` | `125` |

## Assembling

The web tool (`compiler/`) compiles `.j` directly. With the Python assembler,
run it from `example_programs/assembly/` (it resolves `../../rom/` relative to
the working directory):

```bash
cd example_programs/assembly
python assembler.py ../../silicon_bugs_programs/divzero.j -o ../../silicon_bugs_programs/divzero.o
```
