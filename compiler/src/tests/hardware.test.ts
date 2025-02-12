import { Lexer } from '../core/lexer';
import { Parser } from '../core/parser';
import { HardwareCompiler } from '../vm/hardware_compiler';
import { HardwareVM } from '../vm/hardware_vm';

describe('Hardware VM Tests', () => {
  const source = `
    var count = 5
    var sum = 0
    
    while (count > 0) {
      sum = sum + count
      count = count - 1
    }
    
    out sum  // Should output 15 (5 + 4 + 3 + 2 + 1)
  `;

  let program: number[];
  let vm: HardwareVM;

  beforeEach(() => {
    // Compile the program
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiler = new HardwareCompiler();
    const assembly = compiler.compileToAssembly(ast);
    program = compiler.compileToBytecode(assembly);

    // Initialize VM
    vm = new HardwareVM();
    vm.loadProgram(program);
  });

  test('program compilation generates valid machine code', () => {
    expect(program).toBeDefined();
    expect(program.length).toBeGreaterThan(0);
  });

  test('program executes correctly and outputs 15', () => {
    const MAX_STEPS = 100;
    let stepCount = 0;
    let lastOutput: number | undefined;

    // Mock the output function to capture the result
    vm.setOutputCallback((value) => {
      lastOutput = value;
    });

    // Execute program
    while (vm.step() && stepCount < MAX_STEPS) {
      stepCount++;
    }

    expect(stepCount).toBeLessThan(MAX_STEPS);
    expect(lastOutput).toBe(15);
  });

  test('registers are updated correctly during execution', () => {
    const states: any[] = [];
    let stepCount = 0;
    const MAX_STEPS = 100;

    while (vm.step() && stepCount < MAX_STEPS) {
      states.push({
        pc: vm.getProgramCounter(),
        instruction: vm.getCurrentInstruction(),
        A: vm.getRegisterA(),
        B: vm.getRegisterB(),
        C: vm.getRegisterC(),
        D: vm.getRegisterD(),
        flags: vm.getFlags()
      });
      stepCount++;
    }

    expect(stepCount).toBeLessThan(MAX_STEPS);
    expect(states.length).toBeGreaterThan(0);

    // Verify initial state
    expect(states[0].A).toBe(5); // count should be initialized to 5
    expect(states[0].B).toBe(0); // sum should be initialized to 0

    // Verify final state
    const finalState = states[states.length - 1];
    expect(finalState.A).toBe(0); // count should be 0
    expect(finalState.B).toBe(15); // sum should be 15
  });
}); 