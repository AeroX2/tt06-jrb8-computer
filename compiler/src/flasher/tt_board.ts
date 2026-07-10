// WebSerial driver for a Tiny Tapeout demo board.
//
// This is a self-contained re-implementation of the protocol used by
// https://github.com/TinyTapeout/tinytapeout-flasher (Apache-2.0). It talks to
// the RP2040 MicroPython raw REPL to:
//   1. flash a raw binary image to the QSPI Pmod SPI flash (the ROM), and
//   2. enable a specific project on the mux and clock it at a given frequency.
//
// The two on-device scripts (ttinit.py / ttflash.py) are vendored verbatim next
// to this file and pasted into the board's raw REPL at runtime.

import ttInit from "./ttinit.py";
import ttFlash from "./ttflash.py";

/* eslint-disable no-control-regex */

export interface FlashProgress {
  written: number;
  total: number;
}

export interface TTBoardOptions {
  /** Called with a human-readable status/log line (both sent and received). */
  onLog?: (line: string, sent: boolean) => void;
}

const RAW_REPL_ENTER = "\x01"; // Ctrl-A
const RAW_REPL_EXIT = "\x02"; // Ctrl-B
const EXECUTE = "\x04"; // Ctrl-D (raw REPL: run the pasted block)
const INTERRUPT_AND_EXIT = "\x03\x03\x02"; // Ctrl-C Ctrl-C Ctrl-B

const SECTOR_SIZE = 4096;

/** Splits an incoming text stream into trimmed lines. */
class LineBreakTransformer implements Transformer<string, string> {
  private buffer = "";

  transform(chunk: string, controller: TransformStreamDefaultController<string>) {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r\n|\r|\n/);
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      controller.enqueue(line);
    }
  }

  flush(controller: TransformStreamDefaultController<string>) {
    if (this.buffer.length > 0) {
      controller.enqueue(this.buffer);
      this.buffer = "";
    }
  }
}

// Strip the raw-REPL "OK" framing and ANSI escape codes from a received line.
function cleanupRawREPL(value: string): string {
  return value.replace(/^(\x04+>OK)+\x04*/, "").replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

export class TTBoard {
  private reader?: ReadableStreamDefaultReader<string>;
  private readableStreamClosed?: Promise<void>;
  private writableStreamClosed?: Promise<void>;
  private writer?: WritableStreamDefaultWriter<string>;
  private binaryWriter?: WritableStreamDefaultWriter<Uint8Array>;

  private readonly lineListeners = new Set<(line: string) => void>();

  version: string | null = null;
  flashId: string | null = null;
  private booted = false;

  constructor(
    private readonly port: SerialPort,
    private readonly options: TTBoardOptions = {},
  ) {}

  /** Open a Web Serial port and construct a connected board. */
  static async request(options: TTBoardOptions = {}): Promise<TTBoard> {
    if (typeof navigator === "undefined" || !navigator.serial) {
      throw new Error(
        "Web Serial is not available. Use Chrome or Edge over https:// or http://localhost.",
      );
    }
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 }); // ignored by USB-CDC, but required by the API
    const board = new TTBoard(port, options);
    await board.start();
    return board;
  }

  // ---- low-level IO -------------------------------------------------------

  private async writeText(data: string) {
    if (this.binaryWriter) {
      this.binaryWriter.releaseLock();
      this.binaryWriter = undefined;
    }
    if (!this.writer) {
      const textEncoderStream = new TextEncoderStream();
      this.writer = textEncoderStream.writable.getWriter();
      this.writableStreamClosed = textEncoderStream.readable.pipeTo(this.port.writable!);
    }
    await this.writer.write(data);
  }

  private async writeBinary(data: Uint8Array) {
    if (this.writer) {
      await this.writer.close();
      await this.writableStreamClosed;
      this.writer = undefined;
    }
    if (!this.binaryWriter) {
      this.binaryWriter = this.port.writable!.getWriter();
    }
    await this.binaryWriter.write(data);
  }

  /** Run a statement/block in the raw REPL (terminated by Ctrl-D). */
  private async sendCommand(command: string) {
    this.options.onLog?.(command, true);
    await this.writeText(`${command}${EXECUTE}`);
  }

  private processInput(line: string) {
    if (line.startsWith("BOOT: ")) {
      this.booted = true;
    }
    for (const listener of this.lineListeners) {
      listener(line.trim());
    }
    const eq = line.indexOf("=");
    if (eq > 0) {
      const name = line.slice(0, eq);
      const value = line.slice(eq + 1);
      if (name === "tt.sdk_version") {
        this.version = value.replace(/^release_v/, "");
      } else if (name === "tt.flash_id") {
        this.flashId = value.trim();
      }
    }
    this.options.onLog?.(line, false);
  }

  private waitUntil(condition: (line: string) => boolean, timeoutMs = 15000): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.lineListeners.delete(listener);
        reject(new Error("Timed out waiting for board response"));
      }, timeoutMs);
      const listener = (line: string) => {
        if (condition(line)) {
          clearTimeout(timer);
          this.lineListeners.delete(listener);
          resolve(line);
        }
      };
      this.lineListeners.add(listener);
    });
  }

  // ---- lifecycle ----------------------------------------------------------

  /** Start the read loop, ensure a clean REPL, and load the flasher scripts. */
  async start() {
    void this.readLoop();

    // Nudge the REPL and ask for a version to detect current state.
    await this.writeText("\n");
    await this.writeText('print(f"tt.sdk_version={tt.version}")\r\n');
    await delay(100);

    if (this.booted) {
      for (let i = 0; i < 60 && this.version == null; i++) {
        await delay(100);
      }
    }
    if (this.version == null) {
      // Interrupt anything running and drop out of raw REPL, then soft-execute.
      await this.writeText(INTERRUPT_AND_EXIT);
      await this.writeText(EXECUTE);
    }

    await this.writeText(RAW_REPL_ENTER); // enter raw REPL
    await this.writeText(ttInit + EXECUTE); // report versions
    await this.loadFlasher(); // set ASIC_RP_CONTROL, enable chip_rom, build SPIFlash
  }

  /**
   * (Re)run ttflash.py so the RP2040 is in flasher context: ASIC_RP_CONTROL,
   * tt_um_chip_rom enabled, and a fresh SPIFlash driving uio0-3. Needed before
   * programming, including re-flashing after a design has been run.
   */
  async prepareFlash() {
    await this.loadFlasher();
  }

  private async loadFlasher() {
    // ttflash.py prints `tt.flash_id=...` once the flash is detected.
    const ready = this.waitUntil((line) => line.startsWith("tt.flash_id="), 20000);
    await this.writeText(ttFlash + EXECUTE);
    await ready;
  }

  private async readLoop() {
    const { port } = this;
    while (port.readable) {
      const textDecoder = new TextDecoderStream();
      this.readableStreamClosed = port.readable.pipeTo(textDecoder.writable).catch(() => {});
      this.reader = textDecoder.readable
        .pipeThrough(new TransformStream(new LineBreakTransformer()))
        .getReader();
      try {
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) {
            this.reader.releaseLock();
            return;
          }
          if (value) {
            this.processInput(cleanupRawREPL(value));
          }
        }
      } catch {
        // Reader errored (port closed); fall through and let the loop end.
      } finally {
        this.reader.releaseLock();
      }
    }
  }

  // ---- high-level operations ---------------------------------------------

  /**
   * Program a raw binary image into the QSPI Pmod flash starting at `offset`.
   * The image is streamed to the board in 4 KB sector chunks.
   */
  async programFlash(
    offset: number,
    data: Uint8Array,
    onProgress?: (progress: FlashProgress) => void,
  ) {
    const total = data.byteLength;
    const progressListener = (line: string) => {
      if (line.startsWith("flash_prog=")) {
        const value = line.slice("flash_prog=".length);
        if (value === "ok") {
          onProgress?.({ written: total, total });
        } else {
          const lastAddress = parseInt(value, 16);
          if (!Number.isNaN(lastAddress)) {
            onProgress?.({ written: lastAddress - offset, total });
          }
        }
      }
    };
    this.lineListeners.add(progressListener);

    try {
      const startOffset = `0x${offset.toString(16)}`;
      const firstReady = this.waitUntil((line) => line.startsWith("flash_prog="));
      await this.sendCommand(`flash.program_sectors(${startOffset})`);
      await firstReady;

      for (let i = 0; i < data.length; i += SECTOR_SIZE) {
        const sector = data.slice(i, i + SECTOR_SIZE);
        const ready = this.waitUntil((line) => line.startsWith("flash_prog="), 30000);
        await this.writeBinary(new TextEncoder().encode(`${sector.length}\r\n`));
        await this.writeBinary(sector);
        await ready;
      }

      const done = this.waitUntil((line) => line === "flash_prog=ok", 30000);
      await this.writeBinary(new TextEncoder().encode("0\r\n"));
      await done;
    } finally {
      this.lineListeners.delete(progressListener);
    }
  }

  /**
   * Enable project `index` on the mux and clock it at `clockHz`.
   *
   * Note: this is a separate board state from flashing. ttflash.py left the
   * board in ASIC_RP_CONTROL with tt_um_chip_rom enabled; enabling `index`
   * re-safes the bidir pins (via the mux reset) so the ASIC can drive the QSPI
   * flash itself.
   */
  /** Run a raw-REPL block and wait for `<token>=ok`, surfacing tracebacks. */
  private async runBlock(lines: string[], okToken: string) {
    const script = [...lines, `print("${okToken}=ok")`].join("\n");
    const done = this.waitUntil(
      (line) => line === `${okToken}=ok` || line.startsWith("Traceback"),
      20000,
    );
    await this.sendCommand(script);
    const result = await done;
    if (result.startsWith("Traceback")) {
      throw new Error(`Board raised an error during "${okToken}" (see log).`);
    }
  }

  /** Enable a project on the mux (does not touch the clock). */
  async enableDesign(index: number) {
    await this.runBlock(
      [
        "from ttboard.mode import RPMode",
        "tt.mode = RPMode.ASIC_RP_CONTROL",
        `tt.shuttle[${index}].enable()`,
      ],
      "des",
    );
  }

  /**
   * Set the project clock frequency (Hz). Safe to call repeatedly, no reflash.
   *
   * clock_project_PWM rejects freqHz > max_rp2040_freq // 2 (default 133 MHz ->
   * 66.5 MHz ceiling), so for higher targets we raise max_rp2040_freq to
   * overclock the RP2040 sysclk, matching what Commander does for 75/100 MHz.
   */
  async setClock(clockHz: number) {
    const maxRp2040 = Math.max(133_000_000, clockHz * 2);
    await this.runBlock(
      [`tt.clock_project_PWM(${clockHz}, max_rp2040_freq=${maxRp2040})`],
      "clk",
    );
  }

  /** Enable a project and start its clock in one step. */
  async runDesign(index: number, clockHz: number) {
    await this.enableDesign(index);
    await this.setClock(clockHz);
  }

  async close() {
    try {
      await this.reader?.cancel();
    } catch {
      /* ignore */
    }
    await this.readableStreamClosed?.catch(() => {});
    try {
      await this.writeText(INTERRUPT_AND_EXIT); // stop running code, leave raw REPL
    } catch {
      /* ignore */
    }
    try {
      await this.writer?.close();
      await this.writableStreamClosed?.catch(() => {});
      if (this.binaryWriter) {
        await this.binaryWriter.close();
      }
    } catch {
      /* ignore */
    }
    await this.port.close();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
