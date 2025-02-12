import { Lexer } from './src/core/lexer';
import { Parser } from './src/core/parser';
import { HardwareCompiler } from './src/vm/hardware_compiler';
export class CompileError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CompileError';
    }
}
export async function compile(source) {
    try {
        // Compile the source
        const lexer = new Lexer(source);
        const tokens = lexer.scanTokens();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        const compiler = new HardwareCompiler();
        const machineCode = compiler.compile(ast);
        // Generate hex representation
        const hexCode = machineCode.map(byte => byte.toString(16).padStart(2, '0'));
        return {
            machineCode,
            hexCode,
        };
    }
    catch (error) {
        throw new CompileError(error instanceof Error ? error.message : 'Unknown compilation error');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vd2ViLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUN6QyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDM0MsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFPOUQsTUFBTSxPQUFPLFlBQWEsU0FBUSxLQUFLO0lBQ25DLFlBQVksT0FBZTtRQUN2QixLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDZixJQUFJLENBQUMsSUFBSSxHQUFHLGNBQWMsQ0FBQztJQUMvQixDQUFDO0NBQ0o7QUFFRCxNQUFNLENBQUMsS0FBSyxVQUFVLE9BQU8sQ0FBQyxNQUFjO0lBQ3hDLElBQUksQ0FBQztRQUNELHFCQUFxQjtRQUNyQixNQUFNLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNoQyxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDbEMsTUFBTSxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbEMsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzNCLE1BQU0sUUFBUSxHQUFHLElBQUksZ0JBQWdCLEVBQUUsQ0FBQztRQUN4QyxNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRTFDLDhCQUE4QjtRQUM5QixNQUFNLE9BQU8sR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFFNUUsT0FBTztZQUNILFdBQVc7WUFDWCxPQUFPO1NBQ1YsQ0FBQztJQUNOLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2IsTUFBTSxJQUFJLFlBQVksQ0FBQyxLQUFLLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO0lBQ2pHLENBQUM7QUFDTCxDQUFDIn0=