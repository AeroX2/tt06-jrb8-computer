import path from 'path';
import fs from 'fs';
import { HardwareVM } from '../vm/hardware_vm';
import { Assembler } from '../core/assembler';

const assemblyDir = path.join(__dirname, '../../../example_programs/assembly');

interface ExpectedState {
  maxSteps: number;
  inputs: number[];
  outputs: number[];
  memory: Map<number, number>;
}

function parseExpectedFile(content: string): ExpectedState {
  const lines = content.trim().split('\n');
  const result: ExpectedState = {
    maxSteps: 1000,
    inputs: [],
    outputs: [],
    memory: new Map()
  };

  for (const line of lines) {
    const [key, value] = line.split(':').map(s => s.trim());
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
    console.log(bytecode.map(b => b.toString(16).padStart(2, '0')).join(' '));

    const vm = new HardwareVM();
    const actualOutputs: number[] = [];
    
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
    while (vm.step() && stepCount < expectedState.maxSteps) {
      stepCount++;
    }

    // Verify execution
    expect(stepCount).toBeLessThan(expectedState.maxSteps);

    // Verify outputs
    expect(actualOutputs).toEqual(expectedState.outputs);

    // Verify memory state
    expectedState.memory.forEach((expectedValue, address) => {
      const actualValue = vm.getRam()[address];
      expect(actualValue).toEqual(expectedValue);
    });
  });
});