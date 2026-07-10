// Ambient declarations for the flasher module.

// Python scripts are imported as raw text via esbuild's `--loader:.py=text`
// (and Vite's `?raw` style). tsc treats them as string modules.
declare module "*.py" {
  const content: string;
  export default content;
}

// Minimal Web Serial API surface (https://wicg.github.io/serial/), only the
// members this project uses. Avoids pulling in @types/w3c-web-serial.
interface SerialPort {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  getInfo(): { usbVendorId?: number; usbProductId?: number };
}

interface SerialPortRequestOptions {
  filters?: Array<{ usbVendorId?: number; usbProductId?: number }>;
}

interface Serial {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

interface Navigator {
  readonly serial: Serial;
}
