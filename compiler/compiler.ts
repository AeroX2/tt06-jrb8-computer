import * as fs from "fs";
import { Lexer } from "./src/core/lexer";
import { Parser } from "./src/core/parser";
import { HardwareCompiler } from "./src/vm/hardware_compiler";

if (process.argv.length < 3) {
  console.error("Usage: node compiler.js <source_file> [-o output_file]");
  process.exit(1);
}

const args = process.argv.slice(2);
let inputFile = "";
let outputFile = "";

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === "-o" && i + 1 < args.length) {
    outputFile = args[++i];
  } else {
    inputFile = args[i];
  }
}

// Set default output file if none specified
if (!outputFile) {
  outputFile = inputFile.replace(/\.[^/.]+$/, "") + ".o";
}

try {
  // Read source file
  const source = fs.readFileSync(inputFile, "utf8");

  // Compile
  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const compiler = new HardwareCompiler();
  const assembly = compiler.compileToAssembly(ast);
  const machineCode = compiler.compileToBytecode(assembly);

  // Write to file
  if (outputFile === "-") {
    // Output to console
    console.log("Machine code:");
    console.log(machineCode.map(byte => byte.toString(16).padStart(2, "0")).join(" "));
  } else {
    // Write binary output
    const buffer = Buffer.from(machineCode);
    fs.writeFileSync(outputFile, buffer);
    console.log(`Compilation successful! Output written to ${outputFile}`);
  }
} catch (error) {
  console.error("Compilation error:", error instanceof Error ? error.message : "Unknown error");
  process.exit(1);
}
