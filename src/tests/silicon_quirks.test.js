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
        const out = [];
        vm.setOutputCallback(v => out.push(v));
        // load a 42; save a mar; load b 7; load ram[b] c; load d 99; save d ram[current];
        // load ram[42] a; out a; load ram[7] a; out a; halt
        vm.loadProgram([
            0xd0, 42, 0xe0, 0xd1, 7, 0xc6, 0xd3, 99, 0xe7, 0xd4, 42, 0xf4, 0xd4, 7, 0xf4, 0xff,
        ]);
        let n = 0;
        while (vm.step() && n < 100)
            n++;
        // silicon: save d ram[current] wrote ram[7] (clobbered mar), not ram[42]
        expect(out).toEqual([0, 99]);
        expect(vm.getRam()[7]).toBe(99);
        expect(vm.getRam()[42]).toBe(0);
    });
});
describe("Assembler rejects opcodes broken on silicon", () => {
    const assemble = (line) => () => new Assembler().assemble([line]);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2lsaWNvbl9xdWlya3MudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy90ZXN0cy9zaWxpY29uX3F1aXJrcy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBRTlELDRFQUE0RTtBQUM1RSxtRkFBbUY7QUFDbkYsNENBQTRDO0FBRTVDLFFBQVEsQ0FBQywwQ0FBMEMsRUFBRSxHQUFHLEVBQUU7SUFDeEQsSUFBSSxDQUFDLHNEQUFzRCxFQUFFLEdBQUcsRUFBRTtRQUNoRSxNQUFNLEVBQUUsR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDO1FBQzVCLGdGQUFnRjtRQUNoRixFQUFFLENBQUMsV0FBVyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ25DLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLG1CQUFtQjtRQUM5QixFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyx5REFBeUQ7UUFDcEUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzlDLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHdEQUF3RCxFQUFFLEdBQUcsRUFBRTtRQUNsRSxNQUFNLEVBQUUsR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDO1FBQzVCLG1EQUFtRDtRQUNuRCxFQUFFLENBQUMsV0FBVyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsb0JBQW9CO1FBQ3hELEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNWLE1BQU0sQ0FBQyxFQUFFLENBQUMsaUJBQWlCLEVBQUUsQ0FB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