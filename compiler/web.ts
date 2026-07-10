import { Lexer } from "./src/core/lexer";
import { Parser } from "./src/core/parser";
import { HardwareCompiler } from "./src/vm/hardware_compiler";
import { Assembler } from "./src/core/assembler";
import { TTBoard } from "./src/flasher/tt_board";
import type { FlashProgress } from "./src/flasher/tt_board";

export { TTBoard };
export type { FlashProgress };

export interface CompilationResult {
  assembly: string[];
  machineCode: number[];
}

export type SourceKind = "jrp" | "asm";

export class CompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompileError";
  }
}

/** Decide whether a source file is JRP (high level) or raw JRB8 assembly. */
export function detectSourceKind(source: string, filename?: string): SourceKind {
  if (filename) {
    const ext = filename.toLowerCase().split(".").pop();
    if (ext === "jrp") return "jrp";
    if (ext === "j" || ext === "asm" || ext === "s") return "asm";
  }
  // Heuristic fallback: only treat as JRP when JRP-only constructs are present
  // (`out` alone is ambiguous - both languages have it). Assembly uses `:labels`.
  if (/\b(var|while|if|else)\b|[{}]/.test(source) && !/^\s*:/m.test(source)) {
    return "jrp";
  }
  return "asm";
}

/** Compile raw JRB8 assembly (.j) text into machine code. */
export function compileAssembly(source: string): CompilationResult {
  const assembler = new Assembler();
  const assembly = source.split("\n");
  const bytecode = assembler.assemble(assembly);
  const machineCode = assembler.hexOutput(bytecode);
  return { assembly, machineCode };
}

/** Compile JRP (.jrp) high-level source into machine code. */
export function compileJrp(source: string): CompilationResult {
  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const compiler = new HardwareCompiler();
  const assembly = compiler.compileToAssembly(ast);
  const machineCode = compiler.compileToBytecode(assembly);
  return { assembly, machineCode };
}

/**
 * Compile either a `.jrp` program or a `.j` assembly program to machine code.
 * The output bytes are the raw ROM image (offset 0).
 */
export async function compileSource(source: string, filename?: string): Promise<CompilationResult> {
  try {
    const kind = detectSourceKind(source, filename);
    return kind === "jrp" ? compileJrp(source) : compileAssembly(source);
  } catch (error) {
    throw new CompileError(error instanceof Error ? error.message : "Unknown compilation error");
  }
}

/** Backwards-compatible entry point (JRP only), kept for existing callers. */
export async function compile(source: string): Promise<CompilationResult> {
  try {
    return compileJrp(source);
  } catch (error) {
    throw new CompileError(error instanceof Error ? error.message : "Unknown compilation error");
  }
}

export interface FlashAndRunOptions {
  /** Mux index of the project to enable after flashing (default 204). */
  projectIndex?: number;
  /** Project clock frequency in Hz after flashing (default 30 MHz). */
  clockHz?: number;
  /** Flash offset for the ROM image (default 0). */
  offset?: number;
  onProgress?: (progress: FlashProgress) => void;
  onLog?: (line: string, sent: boolean) => void;
}

/**
 * One-shot: prompt for a serial port, flash the given ROM image, then enable the
 * project and start its clock. Returns the connected board (still open) so the
 * caller can keep logging or close it.
 */
export async function flashAndRun(
  machineCode: number[] | Uint8Array,
  options: FlashAndRunOptions = {},
): Promise<TTBoard> {
  const { projectIndex = 204, clockHz = 30_000_000, offset = 0, onProgress, onLog } = options;

  const bytes = machineCode instanceof Uint8Array ? machineCode : new Uint8Array(machineCode);
  const board = await TTBoard.request({ onLog });
  await board.programFlash(offset, bytes, onProgress);
  await board.runDesign(projectIndex, clockHz);
  return board;
}
