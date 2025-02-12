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
    let program;
    let vm;
    beforeEach(() => {
        // Compile the program
        const lexer = new Lexer(source);
        const tokens = lexer.scanTokens();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        const compiler = new HardwareCompiler();
        program = compiler.compile(ast);
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
        let lastOutput;
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
        const states = [];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGFyZHdhcmUudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy90ZXN0cy9oYXJkd2FyZS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDdEMsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQ3hDLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQzNELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUUvQyxRQUFRLENBQUMsbUJBQW1CLEVBQUUsR0FBRyxFQUFFO0lBQ2pDLE1BQU0sTUFBTSxHQUFHOzs7Ozs7Ozs7O0dBVWQsQ0FBQztJQUVGLElBQUksT0FBaUIsQ0FBQztJQUN0QixJQUFJLEVBQWMsQ0FBQztJQUVuQixVQUFVLENBQUMsR0FBRyxFQUFFO1FBQ2Qsc0JBQXNCO1FBQ3RCLE1BQU0sS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2hDLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNsQyxNQUFNLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNsQyxNQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDM0IsTUFBTSxRQUFRLEdBQUcsSUFBSSxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3hDLE9BQU8sR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRWhDLGdCQUFnQjtRQUNoQixFQUFFLEdBQUcsSUFBSSxVQUFVLEVBQUUsQ0FBQztRQUN0QixFQUFFLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQzFCLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGtEQUFrRCxFQUFFLEdBQUcsRUFBRTtRQUM1RCxN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