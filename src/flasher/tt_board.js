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
const RAW_REPL_ENTER = "\x01"; // Ctrl-A
const RAW_REPL_EXIT = "\x02"; // Ctrl-B
const EXECUTE = "\x04"; // Ctrl-D (raw REPL: run the pasted block)
const INTERRUPT_AND_EXIT = "\x03\x03\x02"; // Ctrl-C Ctrl-C Ctrl-B
const SECTOR_SIZE = 4096;
/** Splits an incoming text stream into trimmed lines. */
class LineBreakTransformer {
    buffer = "";
    transform(chunk, controller) {
        this.buffer += chunk;
        const lines = this.buffer.split(/\r\n|\r|\n/);
        this.buffer = lines.pop() ?? "";
        for (const line of lines) {
            controller.enqueue(line);
        }
    }
    flush(controller) {
        if (this.buffer.length > 0) {
            controller.enqueue(this.buffer);
            this.buffer = "";
        }
    }
}
// Strip the raw-REPL "OK" framing and ANSI escape codes from a received line.
function cleanupRawREPL(value) {
    return value.replace(/^(\x04+>OK)+\x04*/, "").replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}
export class TTBoard {
    port;
    options;
    reader;
    readableStreamClosed;
    writableStreamClosed;
    writer;
    binaryWriter;
    lineListeners = new Set();
    version = null;
    flashId = null;
    booted = false;
    constructor(port, options = {}) {
        this.port = port;
        this.options = options;
    }
    /** Open a Web Serial port and construct a connected board. */
    static async request(options = {}) {
        if (typeof navigator === "undefined" || !navigator.serial) {
            throw new Error("Web Serial is not available. Use Chrome or Edge over https:// or http://localhost.");
        }
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 }); // ignored by USB-CDC, but required by the API
        const board = new TTBoard(port, options);
        await board.start();
        return board;
    }
    // ---- low-level IO -------------------------------------------------------
    async writeText(data) {
        if (this.binaryWriter) {
            this.binaryWriter.releaseLock();
            this.binaryWriter = undefined;
        }
        if (!this.writer) {
            const textEncoderStream = new TextEncoderStream();
            this.writer = textEncoderStream.writable.getWriter();
            this.writableStreamClosed = textEncoderStream.readable.pipeTo(this.port.writable);
        }
        await this.writer.write(data);
    }
    async writeBinary(data) {
        if (this.writer) {
            await this.writer.close();
            await this.writableStreamClosed;
            this.writer = undefined;
        }
        if (!this.binaryWriter) {
            this.binaryWriter = this.port.writable.getWriter();
        }
        await this.binaryWriter.write(data);
    }
    /** Run a statement/block in the raw REPL (terminated by Ctrl-D). */
    async sendCommand(command) {
        this.options.onLog?.(command, true);
        await this.writeText(`${command}${EXECUTE}`);
    }
    processInput(line) {
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
            }
            else if (name === "tt.flash_id") {
                this.flashId = value.trim();
            }
        }
        this.options.onLog?.(line, false);
    }
    waitUntil(condition, timeoutMs = 15000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.lineListeners.delete(listener);
                reject(new Error("Timed out waiting for board response"));
            }, timeoutMs);
            const listener = (line) => {
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
    async loadFlasher() {
        // ttflash.py prints `tt.flash_id=...` once the flash is detected.
        const ready = this.waitUntil((line) => line.startsWith("tt.flash_id="), 20000);
        await this.writeText(ttFlash + EXECUTE);
        await ready;
    }
    async readLoop() {
        const { port } = this;
        while (port.readable) {
            const textDecoder = new TextDecoderStream();
            this.readableStreamClosed = port.readable.pipeTo(textDecoder.writable).catch(() => { });
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
            }
            catch {
                // Reader errored (port closed); fall through and let the loop end.
            }
            finally {
                this.reader.releaseLock();
            }
        }
    }
    // ---- high-level operations ---------------------------------------------
    /**
     * Program a raw binary image into the QSPI Pmod flash starting at `offset`.
     * The image is streamed to the board in 4 KB sector chunks.
     */
    async programFlash(offset, data, onProgress) {
        const total = data.byteLength;
        const progressListener = (line) => {
            if (line.startsWith("flash_prog=")) {
                const value = line.slice("flash_prog=".length);
                if (value === "ok") {
                    onProgress?.({ written: total, total });
                }
                else {
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
        }
        finally {
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
    async runBlock(lines, okToken) {
        const script = [...lines, `print("${okToken}=ok")`].join("\n");
        const done = this.waitUntil((line) => line === `${okToken}=ok` || line.startsWith("Traceback"), 20000);
        await this.sendCommand(script);
        const result = await done;
        if (result.startsWith("Traceback")) {
            throw new Error(`Board raised an error during "${okToken}" (see log).`);
        }
    }
    /** Enable a project on the mux (does not touch the clock). */
    async enableDesign(index) {
        await this.runBlock([
            "from ttboard.mode import RPMode",
            "tt.mode = RPMode.ASIC_RP_CONTROL",
            `tt.shuttle[${index}].enable()`,
        ], "des");
    }
    /**
     * Set the project clock frequency (Hz). Safe to call repeatedly, no reflash.
     *
     * clock_project_PWM rejects freqHz > max_rp2040_freq // 2 (default 133 MHz ->
     * 66.5 MHz ceiling), so for higher targets we raise max_rp2040_freq to
     * overclock the RP2040 sysclk, matching what Commander does for 75/100 MHz.
     */
    async setClock(clockHz) {
        const maxRp2040 = Math.max(133_000_000, clockHz * 2);
        await this.runBlock([`tt.clock_project_PWM(${clockHz}, max_rp2040_freq=${maxRp2040})`], "clk");
    }
    /** Enable a project and start its clock in one step. */
    async runDesign(index, clockHz) {
        await this.enableDesign(index);
        await this.setClock(clockHz);
    }
    async close() {
        try {
            await this.reader?.cancel();
        }
        catch {
            /* ignore */
        }
        await this.readableStreamClosed?.catch(() => { });
        try {
            await this.writeText(INTERRUPT_AND_EXIT); // stop running code, leave raw REPL
        }
        catch {
            /* ignore */
        }
        try {
            await this.writer?.close();
            await this.writableStreamClosed?.catch(() => { });
            if (this.binaryWriter) {
                await this.binaryWriter.close();
            }
        }
        catch {
            /* ignore */
        }
        await this.port.close();
    }
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHRfYm9hcmQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvZmxhc2hlci90dF9ib2FyZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxrREFBa0Q7QUFDbEQsRUFBRTtBQUNGLHFFQUFxRTtBQUNyRSwrRUFBK0U7QUFDL0Usc0NBQXNDO0FBQ3RDLDBFQUEwRTtBQUMxRSwrRUFBK0U7QUFDL0UsRUFBRTtBQUNGLGdGQUFnRjtBQUNoRixnRUFBZ0U7QUFFaEUsT0FBTyxNQUFNLE1BQU0sYUFBYSxDQUFDO0FBQ2pDLE9BQU8sT0FBTyxNQUFNLGNBQWMsQ0FBQztBQWNuQyxNQUFNLGNBQWMsR0FBRyxNQUFNLENBQUMsQ0FBQyxTQUFTO0FBQ3hDLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxDQUFDLFNBQVM7QUFDdkMsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLENBQUMsMENBQTBDO0FBQ2xFLE1BQU0sa0JBQWtCLEdBQUcsY0FBYyxDQUFDLENBQUMsdUJBQXVCO0FBRWxFLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQztBQUV6Qix5REFBeUQ7QUFDekQsTUFBTSxvQkFBb0I7SUFDaEIsTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUVwQixTQUFTLENBQUMsS0FBYSxFQUFFLFVBQW9EO1FBQzNFLElBQUksQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDO1FBQ3JCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQzlDLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsQ0FBQztRQUNoQyxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRSxDQUFDO1lBQ3pCLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDM0IsQ0FBQztJQUNILENBQUM7SUFFRCxLQUFLLENBQUMsVUFBb0Q7UUFDeEQsSUFBSSxJQUFJLENB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