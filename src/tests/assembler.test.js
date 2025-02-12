import { Assembler } from '../core/assembler';
describe('Assembler Tests', () => {
    let assembler;
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
            0xd0, 0x05, // load rom a 5
            0xd1, 0x03, // load rom b 3
            0x6c, // add a b
            0xf4, // out a
            0xff // halt
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
            0xd0, 0x01, // load rom a 1
            0xf4, // out a
            0x30, 0x00, 0x00, // jmp start (jumps to offset 0)
            0xff // halt
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
            0xd0, 0x2a, // load rom a 42
            0xec, 0x00, // save a ram[0]
            0xd5, 0x00, // load ram[0] b
            0xf5, // out b
            0xff // halt
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZW1ibGVyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvdGVzdHMvYXNzZW1ibGVyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBRTlDLFFBQVEsQ0FBQyxpQkFBaUIsRUFBRSxHQUFHLEVBQUU7SUFDL0IsSUFBSSxTQUFvQixDQUFDO0lBRXpCLFVBQVUsQ0FBQyxHQUFHLEVBQUU7UUFDZCxTQUFTLEdBQUcsSUFBSSxTQUFTLEVBQUUsQ0FBQztJQUM5QixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyw2QkFBNkIsRUFBRSxHQUFHLEVBQUU7UUFDdkMsTUFBTSxRQUFRLEdBQUc7WUFDZixjQUFjO1lBQ2QsY0FBYztZQUNkLFNBQVM7WUFDVCxPQUFPO1lBQ1AsTUFBTTtTQUNQLENBQUM7UUFFRixNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUNuRSxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDO1lBQ3ZCLElBQUksRUFBRSxJQUFJLEVBQUcsZUFBZTtZQUM1QixJQUFJLEVBQUUsSUFBSSxFQUFHLGVBQWU7WUFDNUIsSUFBSSxFQUFTLFVBQVU7WUFDdkIsSUFBSSxFQUFTLFFBQVE7WUFDckIsSUFBSSxDQUFTLE9BQU87U0FDckIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsa0JBQWtCLEVBQUUsR0FBRyxFQUFFO1FBQzVCLE1BQU0sUUFBUSxHQUFHO1lBQ2YsUUFBUTtZQUNSLGNBQWM7WUFDZCxPQUFPO1lBQ1AsV0FBVztZQUNYLE1BQU07U0FDUCxDQUFDO1FBRUYsTUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDbkUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQztZQUN2QixJQUFJLEVBQUUsSUFBSSxFQUFTLGVBQWU7WUFDbEMsSUFBSSxFQUFlLFFBQVE7WUFDM0IsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUcsZ0NBQWdDO1lBQ25ELElBQUksQ0FBZSxPQUFPO1NBQzNCLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ0gsSUFBSSxDQUFDLG1CQUFtQixFQUFFLEdBQUcsRUFBRTtRQUM3QixNQUFNLFFBQVEsR0FBRztZQUNmLGVBQWU7WUFDZixlQUFlO1lBQ2YsZUFBZTtZQUNmLE9BQU87WUFDUCxNQUFNO1NBQ1AsQ0FBQztRQUVGLE1BQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQ25FLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxPQUFPLENBQUM7WUFDdkIsSUFBSSxFQUFFLElBQUksRUFBRyxnQkFBZ0I7WUFDN0IsSUFBSSxFQUFFLElBQUksRUFBRyxnQkFBZ0I7WUFDN0IsSUFBSSxFQUFFLElBQUksRUFBRyxnQkFBZ0I7WUFDN0IsSUFBSSxFQUFTLFFBQVE7WUFDckIsSUFBSSxDQUFTLE9BQU87U0FDckIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDSCxJQUFJLENBQUMsa0NBQWtDLEVBQUUsR0FBRyxFQUFFO1FBQzVDLE1BQU0sUUFBUSxHQUFHO1lBQ2YsY0FBYztZQUNkLGNBQWM7WUFDZCxTQUFTO1lBQ1QsZ0JBQWdCO1lBQ2hCLGFBQWE7WUFDYixRQUFRO1lBQ1IsT0FBTztZQUNQLFNBQVM7WUFDVCxVQUFVO1lBQ1YsT0FBTztZQUNQLFNBQVM7WUFDVCxPQUFPO1lBQ1AsUUFBUTtZQUNSLE1BQU07WUFDTixPQUFPO1lBQ1AsTUFBTTtTQUNQLENBQUM7UUFFRixNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUNuRSw4Q0FBOEM7UUFDOUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDM0MsTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsMkJBQTJCO0lBQy9FLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMifQ==