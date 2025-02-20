import { Lexer } from "./src/core/lexer";
import { Parser } from "./src/core/parser";
import { HardwareCompiler } from "./src/vm/hardware_compiler";

export interface CompilationResult {
  assembly: string[];
  machineCode: number[];
}

export class CompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompileError";
  }
}

export async function compile(source: string): Promise<CompilationResult> {
  try {
    // Compile the source
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiler = new HardwareCompiler();
    const assembly = compiler.compileToAssembly(ast);
    const machineCode = compiler.compileToBytecode(assembly);

    return {
      assembly,
      machineCode,
    };
  } catch (error) {
    throw new CompileError(error instanceof Error ? error.message : "Unknown compilation error");
  }
}
