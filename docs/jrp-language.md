# The JRP language

JRP is a small high-level language for the JRB8 computer. Programs compile to
JRB8 assembly (and then to machine code) via the TypeScript compiler in
[`compiler/`](../compiler/). It gives you variables, arithmetic, and structured
control flow so you don't have to hand-write assembly.

Everything runs on 8-bit hardware, so JRP is deliberately tiny: **all values are
8-bit (0–255)** and every variable lives in a RAM cell.

## Compiling

```bash
cd compiler && npm install
npm start -- ../example_programs/jrp/simple.jrp -o simple.bin   # -> raw ROM image
npm start -- ../example_programs/jrp/simple.jrp -o -            # print hex to stdout
```

Or use the browser tool (`npm run dev`), which compiles `.jrp` (and `.j`) and can
flash it straight to the board. See [`compiler/README.md`](../compiler/README.md).

## A first program

```jrp
var count = 5
var sum = 0

while (count > 0) {
  sum = sum + count
  count = count - 1
}

out sum          // outputs 15
```

## Lexical basics

- **Comments:** `//` to end of line. There are no block comments.
- **Statement terminators:** none required. Semicolons (`;`) are accepted but
  optional; newlines are just whitespace. Statements end where the grammar says
  they do, so keep one statement per line for readability.
- **Numbers:** decimal `42`, hex `0x2A`, binary `0b101010`, octal `0o52`. Every
  literal must fit in a byte (0–255).
- **Booleans:** `true` and `false` compile to `1` and `0`.
- **Identifiers:** letters, digits, `_`; must start with a letter or `_`.

## Variables

Declare with `var`; assign with `=`. Each variable is a fixed 8-bit RAM cell.

```jrp
var x = 10       // declare + initialise
x = x + 1        // assign
var y            // declare without a value
```

Notes and gotchas:

- Variables are **8-bit and wrap** (`255 + 1 == 0`).
- There is **no scoping**. Declaring `var x` a second time allocates a _new_
  cell, so declare each name once and reuse it.
- Values live in RAM cells numbered from 0 upward, in declaration order.

## Expressions and operators

Expressions are evaluated on 8-bit registers; the result of any expression ends
up in register `a`.

| Category   | Operators            | Notes                                                   |
| ---------- | -------------------- | ------------------------------------------------------- |
| Assignment | `=`                  | Right-associative; target must be a variable.           |
| Logical    | `\|\|`, `&&`         | Short-circuiting. Operands treated as true if non-zero. |
| Equality   | `==`                 | See warning about `!=` below.                           |
| Comparison | `<`, `<=`, `>`, `>=` | Unsigned. Yield `1` or `0`.                             |
| Bitwise    | `&`, `\|`            | Bitwise AND / OR.                                       |
| Add/sub    | `+`, `-`             | 8-bit, wrapping.                                        |
| Mul/div    | `*`, `/`             | `*` keeps the low byte; `/` is integer division.        |
| Unary      | `!`, `-`, `~`        | Logical NOT, negate, bitwise NOT.                       |

Precedence, lowest to highest: assignment → `||` → `&&` → `==` → comparison →
bitwise → `+ -` → `* /` → unary → grouping `( )`. Note bitwise binds **looser**
than `+`/`-`, so `a + b & c` means `(a + b) & c`.

Comparisons and `!` produce a boolean `1`/`0`, so you can store them:

```jrp
var isBig = x > 100      // isBig is 1 or 0
```

There are **no shift operators**. Shift with arithmetic instead: `x * 2` shifts
left, `x / 2` shifts right — handy for walking a bit mask:

```jrp
var mask = 0b10000000
while (mask > 0) {
  if (v & mask) { /* bit is set */ }
  mask = mask / 2
}
```

> **Warning:** `!=` parses but does **not** compile (the code generator only
> implements `==` among equality/inequality). Rewrite `a != b` as `!(a == b)`, or
> test a value directly (`if (x)` is "x is non-zero").

## Control flow

### if / else

```jrp
if (x > 10) {
  out 1
} else {
  out 0
}
```

The condition is true when it evaluates to non-zero. Braces are optional for a
single statement, and `else if` chains work (`else` takes another `if`).

### while

```jrp
while (count > 0) {
  count = count - 1
}
```

### for

The `for` header uses semicolons and any clause may be omitted:

```jrp
for (var i = 0; i < 8; i = i + 1) {
  out i
}
```

Because counters are 8-bit, a single loop can't exceed 255 iterations — nest
loops for more (e.g. `8 * 128 = 1024`).

## Input and output

- `out expr` — evaluate `expr` and drive the 8-bit output register (`uo_out`).
- `in` — an expression that reads the 8-bit input register (`ui_in`).

```jrp
var key = in         // read the input pins
out key + 1          // write to the output pins
```

### Fast I²C byte output: `i2c8`

`i2c8(value)` emits one MSB-first I²C byte on output bits 0 (SDA) and 1 (SCL),
then emits the ninth ACK clock. It is an SSD1306-oriented intrinsic: unlike a
JRP loop which shifts a RAM variable eight times, it generates the eight tests
inline. Use it only when those two output pins are wired as I²C.

```jrp
out 0b11
out 0b10
out 0b00       // START
i2c8(0x78)     // SSD1306 write address
i2c8(0x40)     // data-stream control byte
```

### Indexed memory: `peek` and `poke`

`peek(page, offset)` reads one byte of external RAM at address `{page, offset}`
(a 16-bit address split into an 8-bit page and 8-bit offset). It is the only way
to do indexed memory access — use it to read a large constant blob (a bitmap
font, a lookup table, an animation) that you flashed into the **data image** at
`0x10000`.

```jrp
// walk a 300-byte table stored across RAM pages 1 and 2
var page = 1
var off = 0
var i = 0
while (i < 300) {
  out peek(page, off)
  off = off + 1
  if (off == 0) { page = page + 1 }   // 8-bit offset wrapped -> next page
  i = i + 1
}
```

`peek` leaves the RAM page register back at 0 when it returns, so ordinary
variables (which live on page 0) keep working. Keep the data image on **page 1
and up** — page 0 is where your variables live. See
[`example_programs/jrp/ssd1306_anim.jrp`](../example_programs/jrp/ssd1306_anim.jrp)
(a delta-compressed SSD1306 animation player) and its `gif2bin.py` companion for
a full worked example.

`poke(page, offset, value)` writes a byte to the same paged address space and
returns the value written. It is useful for framebuffers and other indexed data
on writable RAM/PSRAM:

```jrp
var old = peek(3, 42)
poke(3, 42, old | 0x80)
```

Both builtins restore the RAM page to 0 before continuing.

## What JRP does not have

These parse but are rejected by the hardware code generator (or aren't in the
grammar at all):

- **Functions / `return` / calls** — `fun` and `foo()` are not implemented. Inline
  the logic instead.
- **Arrays** — variables are individual cells and there is no `a[i]` syntax. Use
  `peek(page, offset)` and `poke(page, offset, value)` for indexed paged memory,
  or an `if`-chain for a tiny lookup table.
- **Strings** — string literals are rejected.
- **`overflow`** — some older examples reference it, but it is not a keyword and
  will be treated as an undefined variable.

Because of the no-functions/no-arrays limits, larger programs (like the SSD1306
driver) inline their "send a byte" routine and replace lookup tables with
`if`-chains. See
[`example_programs/jrp/ssd1306_pixels.jrp`](../example_programs/jrp/ssd1306_pixels.jrp)
for a full worked example, and the other files in
[`example_programs/jrp/`](../example_programs/jrp/) for smaller ones.

## How it maps to hardware

> **Warning:** every JRP variable lives in external SPI RAM and needs RAM
> _writes_. On the **stock** TinyTapeout QSPI Pmod the RAM region is flash-backed
> and **read-only** (see the caveat in [README.md](./README.md)), so JRP programs
> cannot run there — hand-write register-only assembly instead (constant data can
> still be flashed at `0x10000` and read via `peek`/`load ram[…]`). With the
> **PSRAM hack** (one PSRAM wired to the ROM chip-select, see
> [hardware-errata.md](./hardware-errata.md) / project notes) RAM is writable and
> JRP runs normally.

- Each `var` is assigned the next free RAM cell; reads compile to
  `load ram[addr] a` and writes to `save a ram[addr]`.
- The compiler reserves cells from the top of RAM page 0 when it needs to spill
  operands for nested expressions.
- Expression results are produced in register `a`; binary operators stage the
  second operand through `b`/`c` and use the ALU `opp` instructions.
- `out expr` compiles to the expression followed by `out a`; `in` compiles to
  `in a`.

For the underlying instruction set these lower to, see
[`8-bit-computer-specs.md`](./8-bit-computer-specs.md).
