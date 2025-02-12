import { Token } from '../core/tokens';
import { Assembler } from '../core/assembler';
export class CompileError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CompileError';
    }
}
export class HardwareCompiler {
    variables = new Map();
    nextVarAddress = 0;
    labelCounter = 0;
    compile(statements) {
        this.variables.clear();
        this.nextVarAddress = 0;
        this.labelCounter = 0;
        // Generate assembly code
        const assemblyLines = [];
        for (const stmt of statements) {
            assemblyLines.push(...stmt.accept(this));
        }
        console.log('Generated assembly:', assemblyLines.join('\n'));
        // Convert assembly to bytecode
        const assembler = new Assembler();
        const bytecode = assembler.assemble(assemblyLines);
        // Convert to final numeric bytecode with resolved labels
        const resolvedBytecode = assembler.hexOutput(bytecode);
        if (resolvedBytecode.length === 0) {
            throw new CompileError('Failed to resolve all labels in the bytecode');
        }
        return resolvedBytecode;
    }
    createLabel() {
        return `L${this.labelCounter++}`;
    }
    visit(expr) {
        return expr.accept(this);
    }
    visitBinary(expr) {
        const result = [];
        // For subtraction, evaluate right operand first
        if (expr.op === Token.MINUS) {
            result.push(...expr.right.accept(this));
            result.push('mov a b');
            result.push(...expr.left.accept(this));
            result.push('opp a-b');
        }
        else {
            // For other operations, evaluate left operand first
            result.push(...expr.left.accept(this));
            result.push('mov a b');
            result.push(...expr.right.accept(this));
            switch (expr.op) {
                case Token.PLUS:
                    result.push('opp a+b');
                    break;
                case Token.STAR:
                    result.push('opp a*b');
                    break;
                case Token.SLASH:
                    result.push('opp a/b');
                    break;
                case Token.GREATER:
                case Token.GREATER_EQUAL:
                case Token.LESS:
                case Token.LESS_EQUAL:
                case Token.EQUAL_EQUAL:
                    result.push('cmp a b');
                    break;
            }
        }
        return result;
    }
    visitGrouping(expr) {
        return expr.expression.accept(this);
    }
    visitUnary(expr) {
        const result = expr.right.accept(this);
        switch (expr.op) {
            case Token.MINUS:
                result.push('opp -a');
                break;
            case Token.BANG:
                result.push('cmp a 0');
                break;
        }
        return result;
    }
    visitLiteralBool(expr) {
        return [`load rom a ${expr.val ? 1 : 0}`];
    }
    visitLiteralString(expr) {
        throw new CompileError("String literals not supported in hardware implementation");
    }
    visitLiteralNumber(expr) {
        if (expr.val < 0 || expr.val > 255) {
            throw new CompileError("Number out of range (0-255)");
        }
        return [`load rom a ${expr.val}`];
    }
    visitVariable(expr) {
        const address = this.variables.get(expr.name.value || '');
        if (address === undefined) {
            throw new CompileError(`Undefined variable: ${expr.name.value}`);
        }
        return [`load ram[${address}] a`];
    }
    visitAssign(expr) {
        const result = expr.value.accept(this);
        const address = this.variables.get(expr.name.value || '');
        if (address === undefined) {
            throw new CompileError(`Undefined variable: ${expr.name.value}`);
        }
        result.push(`save a ram[${address}]`);
        return result;
    }
    visitLogical(expr) {
        if (expr.op === Token.AND_AND) {
            const endLabel = this.createLabel();
            const result = expr.left.accept(this);
            result.push('cmp a 0', `jmp = ${endLabel}`);
            result.push(...expr.right.accept(this));
            result.push(`:${endLabel}`);
            return result;
        }
        else if (expr.op === Token.OR_OR) {
            const endLabel = this.createLabel();
            const result = expr.left.accept(this);
            result.push('cmp a 0', `jmp != ${endLabel}`);
            result.push(...expr.right.accept(this));
            result.push(`:${endLabel}`);
            return result;
        }
        throw new CompileError(`Unknown logical operator: ${expr.op}`);
    }
    visitCall(expr) {
        throw new CompileError("Function calls not yet implemented for hardware");
    }
    visitExpressionStmt(stmt) {
        return stmt.expression.accept(this);
    }
    visitIfStmt(stmt) {
        const result = stmt.condition.accept(this);
        const elseLabel = this.createLabel();
        const endLabel = this.createLabel();
        result.push('cmp a 0', `jmp = ${elseLabel}`);
        result.push(...stmt.thenBranch.accept(this));
        result.push(`jmp ${endLabel}`);
        result.push(`:${elseLabel}`);
        if (stmt.elseBranch) {
            result.push(...stmt.elseBranch.accept(this));
        }
        result.push(`:${endLabel}`);
        return result;
    }
    visitWhileStmt(stmt) {
        const startLabel = this.createLabel();
        const endLabel = this.createLabel();
        const result = [];
        result.push(`:${startLabel}`);
        result.push(...stmt.condition.accept(this));
        result.push('cmp a 0', `jmp = ${endLabel}`);
        result.push(...stmt.body.accept(this));
        result.push(`jmp ${startLabel}`);
        result.push(`:${endLabel}`);
        return result;
    }
    visitForStmt(stmt) {
        const result = [];
        if (stmt.initializer) {
            result.push(...stmt.initializer.accept(this));
        }
        const startLabel = this.createLabel();
        const endLabel = this.createLabel();
        const incrementLabel = this.createLabel();
        result.push(`:${startLabel}`);
        if (stmt.condition) {
            result.push(...stmt.condition.accept(this));
            result.push('cmp a 0', `jmp = ${endLabel}`);
        }
        result.push(...stmt.body.accept(this));
        result.push(`:${incrementLabel}`);
        if (stmt.increment) {
            result.push(...stmt.increment.accept(this));
        }
        result.push(`jmp ${startLabel}`);
        result.push(`:${endLabel}`);
        return result;
    }
    visitBlockStmt(stmt) {
        const result = [];
        for (const statement of stmt.statements) {
            result.push(...statement.accept(this));
        }
        return result;
    }
    visitVarStmt(stmt) {
        const result = [];
        const varName = stmt.name;
        const address = this.nextVarAddress++;
        this.variables.set(varName, address);
        if (stmt.initializer) {
            result.push(...stmt.initializer.accept(this), `save a ram[${address}]`);
        }
        return result;
    }
    visitFunctionStmt(stmt) {
        throw new CompileError("Functions not yet implemented for hardware");
    }
    visitReturnStmt(stmt) {
        throw new CompileError("Return not yet implemented for hardware");
    }
    visitOutputStmt(stmt) {
        const result = stmt.expression.accept(this);
        result.push('out a');
        return result;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGFyZHdhcmVfY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvdm0vaGFyZHdhcmVfY29tcGlsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBUUEsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQ3ZDLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUU5QyxNQUFNLE9BQU8sWUFBYSxTQUFRLEtBQUs7SUFDckMsWUFBWSxPQUFlO1FBQ3pCLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNmLElBQUksQ0FBQyxJQUFJLEdBQUcsY0FBYyxDQUFDO0lBQzdCLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxnQkFBZ0I7SUFDbkIsU0FBUyxHQUF3QixJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQzNDLGNBQWMsR0FBVyxDQUFDLENBQUM7SUFDM0IsWUFBWSxHQUFXLENBQUMsQ0FBQztJQUVqQyxPQUFPLENBQUMsVUFBa0I7UUFDeEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUN2QixJQUFJLENBQUMsY0FBYyxHQUFHLENBQUMsQ0FBQztRQUN4QixJQUFJLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQztRQUV0Qix5QkFBeUI7UUFDekIsTUFBTSxhQUFhLEdBQWEsRUFBRSxDQUFDO1FBQ25DLEtBQUssTUFBTSxJQUFJLElBQUksVUFBVSxFQUFFLENBQUM7WUFDOUIsYUFBYSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUMzQyxDQUFDO1FBQ0QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFFN0QsK0JBQStCO1FBQy9CLE1BQU0sU0FBUyxHQUFHLElBQUksU0FBUyxFQUFFLENBQUM7UUFDbEMsTUFB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