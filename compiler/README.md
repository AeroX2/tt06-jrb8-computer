# JRB8 compiler + flasher

Compiles a JRB8 program (`.jrp` high-level or `.j` assembly) to a ROM image and,
from the browser, flashes it to a Tiny Tapeout demo board and starts the CPU.

## Build

```bash
npm install
npm run build      # tsc type-check + esbuild bundle -> dist/bundle.js
npm run dev        # build + serve dist/ and open a browser
```

`npm run dev` serves `dist/index.html`, which loads the bundle.

## Compile only

- Drop a file on the page and click **Download .bin** for the raw ROM image, or
- CLI for `.jrp`: `npm start -- path/to/program.jrp -o out.bin`
- CLI for `.j`: `python ../example_programs/assembly/assembler.py program.j`
  (the browser tool uses a TypeScript port of that assembler; output is byte-identical).

## Flash & run (WebSerial)

Requires Chrome or Edge over `https://` or `http://localhost` (Web Serial).

1. Connect the **QSPI Pmod to the BIDIR (uio) port** of the demo board.
2. Open the page, drop a `.j`/`.jrp` file — it compiles to the ROM image.
3. Click **Flash & Run**. Pick the demo board's serial port. The tool:
   - loads the Tiny Tapeout flasher scripts into the board's MicroPython raw REPL,
   - erases/programs the flash (`uio[0]` CS) with the ROM image at offset 0,
   - enables the project (default index **204**) and clocks it (default **30 MHz**)
     via `tt.shuttle[204].enable()` + `tt.clock_project_PWM(30_000_000)`.

Project index and clock are editable in the UI.

### Important: strap `uio[7] = 1`

The QSPI Pmod flash is a standard 25-series NOR chip and needs 24-bit read
addresses. The JRB8 only issues 24-bit addresses when `uio[7]` (24-bit mode) is
high — see `src/tt_um_aerox2_jrb8_computer.sv` (`address_24bit = uio_in[7]`). Tie
`uio[7]` high or the CPU will read garbage from the flash.

## What's vendored

`src/flasher/ttinit.py` and `src/flasher/ttflash.py` are copied verbatim
(Apache-2.0) from [tinytapeout-flasher](https://github.com/TinyTapeout/tinytapeout-flasher);
they run on the RP2040 and bit-bang the QSPI flash. `src/flasher/tt_board.ts`
re-implements the host-side WebSerial protocol and the firmware calls that
[Commander](https://commander.tinytapeout.com) uses to enable a design and set
its clock.
