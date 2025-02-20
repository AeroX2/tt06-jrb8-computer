import path from "path";
import fs from "fs";
import { HardwareVM } from "../vm/hardware_vm";
import { Assembler } from "../core/assembler";

const assemblyDir = path.join(__dirname, "../../../example_programs/assembly");

interface ExpectedState {
  maxSteps: number;
  inputs: number[];
  outputs: number[];
  memory: Map<number, number>;
}

function parseExpectedFile(content: string): ExpectedState {
  const lines = content.trim().split("\n");
  const result: ExpectedState = {
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
    const actualOutputs: number[] = [];

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
    } else {
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
