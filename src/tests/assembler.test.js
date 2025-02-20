import { Assembler } from "../core/assembler";
describe("Assembler Tests", () => {
    let assembler;
    beforeEach(() => {
        assembler = new Assembler();
    });
    test("basic arithmetic operations", () => {
        const assembly = ["load rom a 5", "load rom b 3", "opp a+b", "out a", "halt"];
        const bytecode = assembler.hexOutput(assembler.assemble(assembly));
        expect(bytecode).toEqual([
            0xd0,
            0x05, // load rom a 5
            0xd1,
            0x03, // load rom b 3
            0x6c, // add a b
            0xf4, // out a
            0xff, // halt
        ]);
    });
    test("labels and jumps", () => {
        const assembly = [":start", "load rom a 1", "out a", "jmp start", "halt"];
        const bytecode = assembler.hexOutput(assembler.assemble(assembly));
        expect(bytecode).toEqual([
            0xd0,
            0x01, // load rom a 1
            0xf4, // out a
            0x30,
            0x00,
            0x00, // jmp start (jumps to offset 0)
            0xff, // halt
        ]);
    });
    test("memory operations", () => {
        const assembly = ["load rom a 42", "save a ram[0]", "load ram[0] b", "out b", "halt"];
        const bytecode = assembler.hexOutput(assembler.assemble(assembly));
        expect(bytecode).toEqual([
            0xd0,
            0x2a, // load rom a 42
            0xec,
            0x00, // save a ram[0]
            0xd5,
            0x00, // load ram[0] b
            0xf5, // out b
            0xff, // halt
        ]);
    });
    test("comparison and conditional jumps", () => {
        const assembly = [
            "load rom a 5",
            "load rom b 3",
            "cmp a b",
            "jmp .> greater",
            "jmp .< less",
            ":equal",
            "opp 0",
            "jmp end",
            ":greater",
            "opp 1",
            "jmp end",
            ":less",
            "opp -1",
            ":end",
            "out a",
            "halt",
        ];
        const bytecode = assembler.hexOutput(assembler.assemble(assembly));
        // Verify bytecode length and key instructions
        expect(bytecode.length).toBeGreaterThan(0);
        expect(bytecode[bytecode.length - 1]).toBe(0xff); // Last instruction is HALT
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZW1ibGVyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvdGVzdHMvYXNzZW1ibGVyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBRTlDLFFBQVEsQ0FBQyxpQkFBaUIsRUFBRSxHQUFHLEVBQUU7SUFDL0IsSUFBSSxTQUFvQixDQUFDO0lBRXpCLFVBQVUsQ0FBQyxHQUFHLEVBQUU7UUFDZCxTQUFTLEdBQUcsSUFBSSxTQUFTLEVBQUUsQ0FBQztJQUM5QixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyw2QkFBNkIsRUFBRSxHQUFHLEVBQUU7UUFDdkMsTUFBTSxRQUFRLEdBQUcsQ0FBQyxjQUFjLEVBQUUsY0FBYyxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFOUUsTUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDbkUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQztZQUN2QixJQUFJO1lBQ0osSUFBSSxFQUFFLGVBQWU7WUFDckIsSUFBSTtZQUNKLElBQUksRUFBRSxlQUFlO1lBQ3JCLElBQUksRUFBRSxVQUFVO1lBQ2hCLElBQUksRUFBRSxRQUFRO1lBQ2QsSUFBSSxFQUFFLE9BQU87U0FDZCxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxrQkFBa0IsRUFBRSxHQUFHLEVBQUU7UUFDNUIsTUFBTSxRQUFRLEdBQUcsQ0FBQyxRQUFRLEVBQUUsY0FBYyxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFMUUsTUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDbkUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQztZQUN2QixJQUFJO1lBQ0osSUFBSSxFQUFFLGVBQWU7WUFDckIsSUFBSSxFQUFFLFFBQVE7WUFDZCxJQUFJO1lBQ0osSUFBSTtZQUNKLElBQUksRUFBRSxnQ0FBZ0M7WUFDdEMsSUFBSSxFQUFFLE9BQU87U0FDZCxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztJQUNILElBQUksQ0FBQyxtQkFBbUIsRUFBRSxHQUFHLEVBQUU7UUFDN0IsTUFBTSxRQUFRLEdBQUcsQ0FBQyxlQUFlLEVBQUUsZUFBZSxFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFdEYsTUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDbkUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQztZQUN2QixJQUFJO1lBQ0osSUFBSSxFQUFFLGdCQUFnQjtZQUN0QixJQUFJO1lBQ0osSUFBSSxFQUFFLGdCQUFnQjtZQUN0QixJQUFJO1lBQ0osSUFBSSxFQUFFLGdCQUFnQjtZQUN0QixJQUFJLEVBQUUsUUFBUTtZQUNkLElBQUksRUFBRSxPQUFPO1NBQ2QsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDSCxJQUFJLENBQUMsa0NBQWtDLEVBQUUsR0FBRyxFQUFFO1FBQzVDLE1BQU0sUUFBUSxHQUFHO1lBQ2YsY0FBYztZQUNkLGNBQWM7WUFDZCxTQUFTO1lBQ1QsZ0JBQWdCO1lBQ2hCLGFBQWE7WUFDYixRQUFRO1lBQ1IsT0FBTztZQUNQLFNBQVM7WUFDVCxVQUFVO1lBQ1YsT0FBTztZQUNQLFNBQVM7WUFDVCxPQUFPO1lBQ1AsUUFBUTtZQUNSLE1BQU07WUFDTixPQUFPO1lBQ1AsTUFBTTtTQUNQLENBQUM7UUFFRixNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUNuRSw4Q0FBOEM7UUFDOUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDM0MsTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsMkJBQTJCO0lBQy9FLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMifQ==