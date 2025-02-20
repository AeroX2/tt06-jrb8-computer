import path from "path";
import fs from "fs";
import { HardwareVM } from "../vm/hardware_vm";
import { Assembler } from "../core/assembler";
const assemblyDir = path.join(__dirname, "../../../example_programs/assembly");
function parseExpectedFile(content) {
    const lines = content.trim().split("\n");
    const result = {
        maxSteps: 500,
        inputs: [],
        outputs: [],
        memory: new Map(),
    };
    for (const line of lines) {
        const [key, value] = line.split(": ").map(s => s.trim());
        switch (key) {
            case "s":
                result.maxSteps = parseInt(value);
                break;
            case "i":
                if (value) {
                    result.inputs = value.split(",").map(v => parseInt(v));
                }
                break;
            case "o":
                if (value) {
                    result.outputs = value.split(",").map(v => parseInt(v));
                }
                break;
            case "r":
                if (value) {
                    value.split(",").forEach(pair => {
                        const [addr, val] = pair.split(":").map(v => parseInt(v));
                        result.memory.set(addr, val);
                    });
                }
                break;
        }
    }
    return result;
}
describe("Assembly Program Validation", () => {
    const testFiles = fs
        .readdirSync(assemblyDir)
        .filter(f => f.endsWith(".e"))
        .map(f => ({
        expectedPath: path.join(assemblyDir, f),
        assemblyPath: path.join(assemblyDir, f.replace(".e", ".j")),
    }));
    test.each(testFiles)("$name validates program execution", ({ assemblyPath, expectedPath }) => {
        // Read and parse files
        const assemblyCode = fs.readFileSync(assemblyPath, "utf-8");
        const expectedState = parseExpectedFile(fs.readFileSync(expectedPath, "utf-8"));
        // Assemble and execute
        const assembler = new Assembler();
        const program = assembler.assemble(assemblyCode.trim().split("\n"));
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
                return inputIndex < expectedState.inputs.length ? expectedState.inputs[inputIndex++] : 0;
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