import { HardwareVM } from "../vm/hardware_vm";
import { Assembler, AssemblerError } from "../core/assembler";

// Silicon-quirk models that cannot be expressed as a normal .j program (the
// assembler now rejects the broken opcodes), plus guards that it does reject them.
// See docs/hardware-errata.md (E4, E5, E7).

describe("E5 — jmp z/o/c/s {number} jumps to {N,N}", () => {
  test("taken branch lands at {N,N}, not the operand address", () => {
    const vm = new HardwareVM();
    // cmp a a -> zero flag set (a defaults to 0); then jmp z 0x20 (bytes 0x3B 0x20)
    vm.loadProgram([0x20, 0x3b, 0x20]);
    vm.step(); // cmp a a -> z = 1
    vm.step(); // jmp z 0x20 -> silicon target = (0x20<<8)|0x20 = 0x2020
    expect(vm.getProgramCounter()).toBe(0x2020);
  });

  test("not-taken branch advances PC by 1 (2-byte instruction)", () => {
    const vm = new HardwareVM();
    // zero flag is false by default -> jmp z not taken
    vm.loadProgram([0x3b, 0x20, 0xff]); // jmp z 0x20 ; halt
    vm.step();
    expect(vm.getProgramCounter()).toBe(2); // opcode(0) + operand(1) -> next at 2
  });
});

describe("E7 — indexed RAM access clobbers MAR", () => {
  test("load ram[reg] overwrites a MAR set by save X mar", () => {
    const vm = new HardwareVM();
    const out: number[] = [];
    vm.setOutputCallback(v => out.push(v));
    // load a 42; save a mar; load b 7; load ram[b] c; load d 99; save d ram[current];
    // load ram[42] a; out a; load ram[7] a; out a; halt
    vm.loadProgram([
      0xd0, 42, 0xe0, 0xd1, 7, 0xc6, 0xd3, 99, 0xe7, 0xd4, 42, 0xf4, 0xd4, 7, 0xf4, 0xff,
    ]);
    let n = 0;
    while (vm.step() && n < 100) n++;
    // silicon: save d ram[current] wrote ram[7] (clobbered mar), not ram[42]
    expect(out).toEqual([0, 99]);
    expect(vm.getRam()[7]).toBe(99);
    expect(vm.getRam()[42]).toBe(0);
  });
});

describe("Assembler rejects opcodes broken on silicon", () => {
  const assemble = (line: string) => () => new Assembler().assemble([line]);

  test("rejects jmp z/o/c/s {number} (E5)", () => {
    expect(assemble("jmp z 0x20")).toThrow(AssemblerError);
    expect(assemble("jmp o 5")).toThrow(AssemblerError);
    expect(assemble("jmp c 5")).toThrow(AssemblerError);
    expect(assemble("jmp s 5")).toThrow(AssemblerError);
  });

  test("rejects jmpr (E4)", () => {
    expect(assemble("jmpr 4")).toThrow(AssemblerError);
    expect(assemble("jmpr != 4")).toThrow(AssemblerError);
  });

  test("still accepts the working jumps and a label that starts with z/o/c/s", () => {
    expect(assemble("jmp = end")).not.toThrow();
    expect(assemble("jmp .< end")).not.toThrow();
    expect(assemble("jmp zone")).not.toThrow(); // label 'zone', not a flag test
    expect(assemble("opp clr")).not.toThrow(); // harmless no-op on silicon (E6)
  });
});
