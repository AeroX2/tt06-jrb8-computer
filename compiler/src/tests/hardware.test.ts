import { Lexer } from '../core/lexer';
import { Parser } from '../core/parser';
import { HardwareCompiler } from '../vm/hardware_compiler';
import { HardwareVM } from '../vm/hardware_vm';
import * as fs from 'fs';
import * as path from 'path';

describe('Hardware VM Integration Tests', () => {
  let vm: HardwareVM;
  let compiler: HardwareCompiler;
  let output: number[];

  beforeEach(() => {
    vm = new HardwareVM();
    compiler = new HardwareCompiler();
    output = [];
    vm.setOutputCallback((value) => output.push(value));
  });

  const runProgram = (filename: string) => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'example_programs', 'jrp', filename),
      'utf8'
    );
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const assembly = compiler.compileToAssembly(ast);
    console.log(assembly);
    const bytecode = compiler.compileToBytecode(assembly);
    vm.loadProgram(bytecode);

    let steps = 10000;
    while (vm.step() && steps > 0) {
      steps--;
    }
    expect(steps).toBeGreaterThan(0);

    return output;
  };

  test('simple program works correctly', () => {
    const results = runProgram('simple.jrp');
    expect(results).toEqual([15]);
  });

  test('arithmetic operations work correctly', () => {
    const results = runProgram('arithmetic.jrp');
    expect(results).toEqual([13, 7, 30, 3]);
  });

  test('nested loops work correctly', () => {
    const results = runProgram('nested_loops.jrp');
    expect(results).toEqual([6]);
  });

  test('comparison operations work correctly', () => {
    const results = runProgram('comparison.jrp');
    expect(results).toEqual([1, 0, 0, 1, 0]);
  });

  test('conditionals work correctly', () => {
    const results = runProgram('conditionals.jrp');
    expect(results).toEqual([1]);
  });

  test('logical operators work correctly', () => {
    const results = runProgram('logical.jrp');
    expect(results).toEqual([1, 0, 1, 0, 1]);
  });

  test('unary operations work correctly', () => {
    const results = runProgram('unary.jrp');
    expect(results).toEqual([-5 & 0xFF, 1, 1, 250]);
  });

  test('variable declarations without initializers work correctly', () => {
    const results = runProgram('var_declarations.jrp');
    expect(results).toEqual([5, 10, 15]);
  });
}); 