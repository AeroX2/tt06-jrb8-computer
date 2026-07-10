# James Retro Byte 8 (JRB8) — Documentation

An 8-bit computer built from the ground up (nand2tetris style), designed in
Logisim Evolution and ported to TinyTapeout. It fetches and runs its program
from an external SPI flash and talks to the world through 8 input and 8 output
pins.

## Contents

- [Architecture & instruction set overview](./info.md) — the block diagram, the
  register/ALU/memory/IO operations, a worked Fibonacci example, and the memory
  map.
- [CU flags & full instruction spec](./8-bit-computer-specs.md) — every
  instruction index and the control-unit flags it asserts.
- [The JRP language](./jrp-language.md) — reference for the high-level language
  that compiles to JRB8 assembly.
- [Results](./results) — post-synthesis / GDS results for the tapeout.

## Toolchain

Programs are written in one of two languages that compile to the same machine
code, then flashed to the SPI ROM:

| Language | Extension | Compiler | Notes |
| --- | --- | --- | --- |
| Assembly | `.j` | `example_programs/assembly/assembler.py` (and a byte-identical TypeScript port in `compiler/`) | Direct instruction set. |
| [JRP](./jrp-language.md) | `.jrp` | `compiler/` (TypeScript) | Small high-level language: `var`, `while`, `if/else`, expressions, `out`. |

The [`compiler/`](../compiler/) folder additionally builds a **WebSerial compile
&amp; flash app**: drop a `.j`/`.jrp` file, flash it to the QSPI Pmod flash, and
start project 204 at a selectable clock (changeable live, without reflashing).
See [`compiler/README.md`](../compiler/README.md).

Example programs for both languages are in
[`example_programs/`](../example_programs/).

## Pinout

| Pins | Direction | Function |
| --- | --- | --- |
| `ui[7:0]` | in | Input register (`in` reads these into a register). |
| `uo[7:0]` | out | Output register (`out` drives these). |
| `uio[0]` | out | `cs rom` — chip select for the program flash. |
| `uio[1]` | out | `mosi` — SPI data to ROM/RAM. |
| `uio[2]` | in | `miso` — SPI data from ROM/RAM. |
| `uio[3]` | out | `sck` — SPI clock. |
| `uio[4]` | out | `cs ram` — chip select for RAM. |
| `uio[7]` | in | 24-bit addressing mode (strap high for a shared 24-bit SPI chip; required by the QSPI Pmod NOR flash). |

## Memory map

The CPU issues 24-bit SPI addresses (standard `0x03` read / `0x02` write):

- **ROM (program):** `0x00_0000`–`0x00_FFFF`. The read address is the 16-bit
  program counter, which resets to 0 — so **place your program at offset 0**.
- **RAM:** `0x01_0000`–`0x01_FFFF`, addressed by the `mpage` (page) and `mar`
  (byte) registers.

The top address byte (`0x00` ROM vs `0x01` RAM) distinguishes the two banks. In
16-bit mode (`uio[7]=0`) that byte is dropped and ROM/RAM must be separate chips
selected by `cs rom` / `cs ram`; in 24-bit mode (`uio[7]=1`) both banks can share
one chip. See [`info.md`](./info.md) for more detail.

## Running on hardware

The computer has no start signal — it begins fetching from the SPI ROM as soon as
`clk` starts ticking. The simplest path is the web app above (flash + clock in
one place). Externally, the SPI mappings are compatible with
[spi-ram-emu](https://github.com/MichaelBell/spi-ram-emu/) and the TinyTapeout
QSPI Pmod.
