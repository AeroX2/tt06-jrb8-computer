![](../../workflows/gds/badge.svg) ![](../../workflows/docs/badge.svg) ![](../../workflows/test/badge.svg)

# James Retro Byte 8 TinyTapeout project

This project is an 8-bit computer I originally designed in Logisim Evolution, which I am now porting to TinyTapeout for manufacturing.

It runs its program from an external SPI flash (a QSPI Pmod on the bidirectional
port) and exposes 8 input pins (`ui_in`) and 8 output pins (`uo_out`). More info
about the architecture and instruction set is in the [Docs](./docs/README.md).

## Writing programs

There are two ways to write programs, both compiling to the same machine code:

- **Assembly (`.j`)** — the raw instruction set. Assemble with the Python
  assembler:
  ```bash
  python3 example_programs/assembly/assembler.py example_programs/assembly/fibonacci.j
  ```
- **JRP (`.jrp`)** — a small high-level language (`var`, `while`, `if`, `out`, …)
  that compiles down to assembly (see the [JRP language reference](./docs/jrp-language.md)).
  Compile with the TypeScript compiler:
  ```bash
  cd compiler && npm install
  npm start -- ../example_programs/jrp/fibonacci.jrp -o fibonacci.bin
  ```

Sample programs for both live in [`example_programs/`](./example_programs/),
including [`ssd1306_pixels.j`](./example_programs/assembly/ssd1306_pixels.j), a
bit-banged I²C driver that draws to an SSD1306 OLED.

## Compile &amp; flash web app

The [`compiler/`](./compiler/) folder also builds a browser tool that compiles a
`.j` or `.jrp` file, flashes it to the QSPI Pmod flash over **WebSerial**, and
starts the CPU — no separate flasher or command-line step needed.

```bash
cd compiler
npm install
npm run dev        # builds and serves the app, opening it in your browser
```

Then, in **Chrome or Edge** (WebSerial is required):

1. Connect the QSPI Pmod to the demo board's **BIDIR (`uio`) port** and strap
   **`uio[7] = 1`** (24-bit addressing — the flash needs 24-bit read addresses).
2. Drop a `.j`/`.jrp` file to compile it to the ROM image.
3. Click **Flash &amp; Run**. The app flashes the image at offset 0, enables
   project **204**, and clocks it at the selected speed. You can change the clock
   afterwards (presets or a custom value) **without reflashing**, and disconnect
   when you're done.

See [`compiler/README.md`](./compiler/README.md) for the full toolchain details.

# What is Tiny Tapeout?

TinyTapeout is an educational project that aims to make it easier and cheaper than ever to get your digital designs manufactured on a real chip.

To learn more and get started, visit https://tinytapeout.com.
