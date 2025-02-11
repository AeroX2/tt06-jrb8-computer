import { Assembler } from '../core/assembler';

describe('Assembler Tests', () => {
  let assembler: Assembler;

  beforeEach(() => {
    assembler = new Assembler();
  });

  test('basic arithmetic operations', () => {
    const assembly = [
      'load rom a 5',
      'load rom b 3',
      'opp a+b',
      'out a',
      'halt'
    ];

    const bytecode = assembler.hexOutput(assembler.assemble(assembly));
    expect(bytecode).toEqual([
      0xd0, 0x05,  // load rom a 5
      0xd1, 0x03,  // load rom b 3
      0x6c,        // add a b
      0xf4,        // out a
      0xff         // halt
    ]);
  });

  test('labels and jumps', () => {
    const assembly = [
      ':start',
      'load rom a 1',
      'out a',
      'jmp start',
      'halt'
    ];

    const bytecode = assembler.hexOutput(assembler.assemble(assembly));
    expect(bytecode).toEqual([
      0xd0, 0x01,        // load rom a 1
      0xf4,              // out a
      0x30, 0x00, 0x00,  // jmp start (jumps to offset 0)
      0xff               // halt
    ]);
  });
  test('memory operations', () => {
    const assembly = [
      'load rom a 42',
      'save a ram[0]',
      'load ram[0] b',
      'out b',
      'halt'
    ];

    const bytecode = assembler.hexOutput(assembler.assemble(assembly));
    expect(bytecode).toEqual([
      0xd0, 0x2a,  // load rom a 42
      0xec, 0x00,  // save a ram[0]
      0xd5, 0x00,  // load ram[0] b
      0xf5,        // out b
      0xff         // halt
    ]);
  });
  test('comparison and conditional jumps', () => {
    const assembly = [
      'load rom a 5',
      'load rom b 3',
      'cmp a b',
      'jmp .> greater',
      'jmp .< less',
      ':equal',
      'opp 0',
      'jmp end',
      ':greater',
      'opp 1',
      'jmp end',
      ':less',
      'opp -1',
      ':end',
      'out a',
      'halt'
    ];

    const bytecode = assembler.hexOutput(assembler.assemble(assembly));
    // Verify bytecode length and key instructions
    expect(bytecode.length).toBeGreaterThan(0);
    expect(bytecode[bytecode.length - 1]).toBe(0xff); // Last instruction is HALT
  });
}); 