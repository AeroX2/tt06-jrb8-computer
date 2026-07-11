import path from "path";
import fs from "fs";
import { HardwareVM } from "../vm/hardware_vm";
import { Assembler } from "../core/assembler";
const assemblyDirs = [
    path.join(__dirname, "../../../example_programs/assembly"),
    path.join(__dirname, "../../../silicon_bugs_programs"),
];
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
    const testFiles = assemblyDirs.flatMap(dir => fs
        .readdirSync(dir)
        .filter(f => f.endsWith(".e"))
        .map(f => ({
        name: f.replace(".e", ""),
        expectedPath: path.join(dir, f),
        assemblyPath: path.join(dir, f.replace(".e", ".j")),
    })));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGFyZHdhcmVfYXNzZW1ibHkudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy90ZXN0cy9oYXJkd2FyZV9hc3NlbWJseS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sSUFBSSxNQUFNLE1BQU0sQ0FBQztBQUN4QixPQUFPLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDcEIsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQy9DLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUU5QyxNQUFNLFlBQVksR0FBRztJQUNuQixJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQ0FBb0MsQ0FBQztJQUMxRCxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxnQ0FBZ0MsQ0FBQztDQUN2RCxDQUFDO0FBU0YsU0FBUyxpQkFBaUIsQ0FBQyxPQUFlO0lBQ3hDLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDekMsTUFBTSxNQUFNLEdBQWtCO1FBQzVCLFFBQVEsRUFBRSxHQUFHO1FBQ2IsTUFBTSxFQUFFLEVBQUU7UUFDVixPQUFPLEVBQUUsRUFBRTtRQUNYLE1BQU0sRUFBRSxJQUFJLEdBQUcsRUFBRTtLQUNsQixDQUFDO0lBRUYsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUUsQ0FBQztRQUN6QixNQUFNLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7UUFDekQsUUFBUSxHQUFHLEVBQUUsQ0FBQztZQUNaLEtBQUssR0FBRztnQkFDTixNQUFNLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxLQUFL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