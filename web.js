import { Lexer } from "./src/core/lexer";
import { Parser } from "./src/core/parser";
import { HardwareCompiler } from "./src/vm/hardware_compiler";
import { Assembler } from "./src/core/assembler";
import { TTBoard } from "./src/flasher/tt_board";
export { TTBoard };
export class CompileError extends Error {
    constructor(message) {
        super(message);
        this.name = "CompileError";
    }
}
/** Decide whether a source file is JRP (high level) or raw JRB8 assembly. */
export function detectSourceKind(source, filename) {
    if (filename) {
        const ext = filename.toLowerCase().split(".").pop();
        if (ext === "jrp")
            return "jrp";
        if (ext === "j" || ext === "asm" || ext === "s")
            return "asm";
    }
    // Heuristic fallback: only treat as JRP when JRP-only constructs are present
    // (`out` alone is ambiguous - both languages have it). Assembly uses `:labels`.
    if (/\b(var|while|if|else)\b|[{}]/.test(source) && !/^\s*:/m.test(source)) {
        return "jrp";
    }
    return "asm";
}
/** Compile raw JRB8 assembly (.j) text into machine code. */
export function compileAssembly(source) {
    const assembler = new Assembler();
    const assembly = source.split("\n");
    const bytecode = assembler.assemble(assembly);
    const machineCode = assembler.hexOutput(bytecode);
    return { assembly, machineCode };
}
/** Compile JRP (.jrp) high-level source into machine code. */
export function compileJrp(source) {
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
export async function compileSource(source, filename) {
    try {
        const kind = detectSourceKind(source, filename);
        return kind === "jrp" ? compileJrp(source) : compileAssembly(source);
    }
    catch (error) {
        throw new CompileError(error instanceof Error ? error.message : "Unknown compilation error");
    }
}
/** Backwards-compatible entry point (JRP only), kept for existing callers. */
export async function compile(source) {
    try {
        return compileJrp(source);
    }
    catch (error) {
        throw new CompileError(error instanceof Error ? error.message : "Unknown compilation error");
    }
}
/**
 * One-shot: prompt for a serial port, flash the given ROM image, then enable the
 * project and start its clock. Returns the connected board (still open) so the
 * caller can keep logging or close it.
 */
export async function flashAndRun(machineCode, options = {}) {
    const { projectIndex = 204, clockHz = 30_000_000, offset = 0, onProgress, onLog } = options;
    const bytes = machineCode instanceof Uint8Array ? machineCode : new Uint8Array(machineCode);
    const board = await TTBoard.request({ onLog });
    await board.programFlash(offset, bytes, onProgress);
    await board.runDesign(projectIndex, clockHz);
    return board;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vd2ViLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUN6QyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDM0MsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDOUQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQ2pELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUdqRCxPQUFPLEVBQUUsT0FBTyxFQUFFLENBQUM7QUFVbkIsTUFBTSxPQUFPLFlBQWEsU0FBUSxLQUFLO0lBQ3JDLFlBQVksT0FBZTtRQUN6QixLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDZixJQUFJLENBQUMsSUFBSSxHQUFHLGNBQWMsQ0FBQztJQUM3QixDQUFDO0NBQ0Y7QUFFRCw2RUFBNkU7QUFDN0UsTUFBTSxVQUFVLGdCQUFnQixDQUFDLE1BQWMsRUFBRSxRQUFpQjtJQUNoRSxJQUFJLFFBQVEsRUFBRSxDQUFDO1FBQ2IsTUFBTSxHQUFHLEdBQUcsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNwRCxJQUFJLEdBQUcsS0FBSyxLQUFLO1lBQUUsT0FBTyxLQUFLLENBQUM7UUFDaEMsSUFBSSxHQUFHLEtBQUssR0FBRyxJQUFJLEdBQUcsS0FBSyxLQUFLLElBQUksR0FBRyxLQUFLLEdBQUc7WUFBRSxPQUFPLEtBQUssQ0FBQztJQUNoRSxDQUFDO0lBQ0QsNkVBQTZFO0lBQzdFLGdGQUFnRjtJQUNoRixJQUFJLDhCQUE4QixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztRQUMx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