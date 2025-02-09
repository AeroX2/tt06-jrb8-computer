import { Lexer } from './src/core/lexer';
import { Parser } from './src/core/parser';
import { HardwareCompiler } from './src/vm/hardware_compiler';
import { decodeInstruction, formatInstruction } from './src/vm/instruction_decoder';

export interface CompilationResult {
    machineCode: number[];
    hexCode: string[];
    instructions: string[];
}

export class CompileError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CompileError';
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
        const machineCode = compiler.compile(ast);

        // Generate human-readable output
        const instructions: string[] = [];
        let i = 0;
        while (i < machineCode.length) {
            const decoded = decodeInstruction(machineCode, i);
            instructions.push(formatInstruction(decoded));
            i = decoded.nextIndex;
        }

        // Generate hex representation
        const hexCode = machineCode.map(byte => byte.toString(16).padStart(2, '0'));

        return {
            machineCode,
            hexCode,
            instructions
        };
    } catch (error) {
        throw new CompileError(error instanceof Error ? error.message : 'Unknown compilation error');
    }
} 