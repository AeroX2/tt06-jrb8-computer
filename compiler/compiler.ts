import * as fs from 'fs';
import { Lexer } from './src/core/lexer';
import { Parser } from './src/core/parser';
import { HardwareCompiler } from './src/vm/hardware_compiler';
import { decodeInstruction, formatInstruction } from './src/vm/instruction_decoder';

if (process.argv.length < 3) {
    console.error('Usage: node compiler.js <source_file> [-o output_file]');
    process.exit(1);
}

const args = process.argv.slice(2);
let inputFile = '';
let outputFile = '';

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
    if (args[i] === '-o' && i + 1 < args.length) {
        outputFile = args[++i];
    } else {
        inputFile = args[i];
    }
}

// Set default output file if none specified
if (!outputFile) {
    outputFile = inputFile.replace(/\.[^/.]+$/, '') + '.o';
}

try {
    // Read source file
    const source = fs.readFileSync(inputFile, 'utf8');

    // Compile
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiler = new HardwareCompiler();
    const machineCode = compiler.compile(ast);

    // Generate output
    const instructions: string[] = [];
    let i = 0;
    while (i < machineCode.length) {
        const decoded = decodeInstruction(machineCode, i);
        instructions.push(formatInstruction(decoded));
        i = decoded.nextIndex;
    }

    // Write to file
    if (outputFile === '-') {
        // Output to console
        console.log('Machine code:');
        console.log(machineCode.map(byte => byte.toString(16).padStart(2, '0')).join(' '));
        console.log('\nDecoded instructions:');
        console.log(instructions.join('\n'));
    } else {
        // Write binary output
        const buffer = Buffer.from(machineCode);
        fs.writeFileSync(outputFile, buffer);
        console.log(`Compilation successful! Output written to ${outputFile}`);
        
        // Write human-readable version
        const debugFile = outputFile + '.txt';
        fs.writeFileSync(debugFile, instructions.join('\n'));
        console.log(`Debug output written to ${debugFile}`);
    }
} catch (error) {
    console.error('Compilation error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
} 