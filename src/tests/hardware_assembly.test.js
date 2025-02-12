import path from 'path';
import fs from 'fs';
import { HardwareVM } from '../vm/hardware_vm';
import { Assembler } from '../core/assembler';
const assemblyDir = path.join(__dirname, '../../../example_programs/assembly');
function parseExpectedFile(content) {
    const lines = content.trim().split('\n');
    const result = {
        maxSteps: 500,
        inputs: [],
        outputs: [],
        memory: new Map()
    };
    for (const line of lines) {
        const [key, value] = line.split(': ').map(s => s.trim());
        switch (key) {
            case 's':
                result.maxSteps = parseInt(value);
                break;
            case 'i':
                if (value) {
                    result.inputs = value.split(',').map(v => parseInt(v));
                }
                break;
            case 'o':
                if (value) {
                    result.outputs = value.split(',').map(v => parseInt(v));
                }
                break;
            case 'r':
                if (value) {
                    value.split(',').forEach(pair => {
                        const [addr, val] = pair.split(':').map(v => parseInt(v));
                        result.memory.set(addr, val);
                    });
                }
                break;
        }
    }
    return result;
}
describe('Assembly Program Validation', () => {
    const testFiles = fs.readdirSync(assemblyDir)
        .filter(f => f.endsWith('.e'))
        .map(f => ({
        name: f,
        expectedPath: path.join(assemblyDir, f),
        assemblyPath: path.join(assemblyDir, f.replace('.e', '.j'))
    }));
    test.each(testFiles)('$name validates program execution', ({ name, assemblyPath, expectedPath }) => {
        // Read and parse files
        const assemblyCode = fs.readFileSync(assemblyPath, 'utf-8');
        const expectedState = parseExpectedFile(fs.readFileSync(expectedPath, 'utf-8'));
        // Assemble and execute
        const assembler = new Assembler();
        const program = assembler.assemble(assemblyCode.trim().split('\n'));
        const bytecode = assembler.hexOutput(program);
        expect(bytecode.length).toBeGreaterThan(0);
        const vm = new HardwareVM();
        const actualOutputs = [];
        vm.setOutputCallback(value => {
            actualOutputs.push(value);
        });
        // Set up inputs if any
        let inputIndex = 0;
        if (expectedState.inputs.length > 0) {
            vm.setInputCallback(() => {
                return inputIndex < expectedState.inputs.length ?
                    expectedState.inputs[inputIndex++] : 0;
            });
        }
        vm.loadProgram(bytecode);
        let stepCount = 0;
        const maxSteps = expectedState.maxSteps < 0 ? 5000 : expectedState.maxSteps;
        // stepCount must stay strictly less than maxSteps
        while (vm.step() && stepCount < maxSteps - 1) {
            stepCount++;
        }
        // Verify execution
        if (expectedState.maxSteps > 0) {
            // If stepCount is equal to maxSteps, the program ran over the limit
            expect(stepCount).toBeLessThan(maxSteps);
        }
        // Verify outputs
        if (expectedState.maxSteps < 0) {
            // For infinite programs, check if output starts with the expected sequence
            const expectedStr = expectedState.outputs;
            const actualStr = actualOutputs.slice(0, expectedState.outputs.length);
            expect(actualStr).toEqual(expectedStr);
        }
        else {
            // For finite programs, check exact match
            expect(actualOutputs).toEqual(expectedState.outputs);
        }
        // Verify memory state
        expectedState.memory.forEach((expectedValue, address) => {
            const actualValue = vm.getRam()[address];
            expect(actualValue).toEqual(expectedValue);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGFyZHdhcmVfYXNzZW1ibHkudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy90ZXN0cy9oYXJkd2FyZV9hc3NlbWJseS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sSUFBSSxNQUFNLE1BQU0sQ0FBQztBQUN4QixPQUFPLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDcEIsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQy9DLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUU5QyxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQ0FBb0MsQ0FBQyxDQUFDO0FBUy9FLFNBQVMsaUJBQWlCLENBQUMsT0FBZTtJQUN4QyxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3pDLE1BQU0sTUFBTSxHQUFrQjtRQUM1QixRQUFRLEVBQUUsR0FBRztRQUNiLE1BQU0sRUFBRSxFQUFFO1FBQ1YsT0FBTyxFQUFFLEVBQUU7UUFDWCxNQUFNLEVBQUUsSUFBSSxHQUFHLEVBQUU7S0FDbEIsQ0FBQztJQUVGLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFLENBQUM7UUFDekIsTUFBTSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3pELFFBQVEsR0FBRyxFQUFFLENBQUM7WUFDWixLQUFLLEdBQUc7Z0JBQ04sTUFBTSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ2xDLE1BQU07WUFDUixLQUFLLEdBQUc7Z0JBQ04sSUFBSSxLQUFLLEVBQUUs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