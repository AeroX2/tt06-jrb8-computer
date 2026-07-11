import { Grouping, LiteralBool, LiteralNumber, Variable, } from "../ast/expressions";
import { Token } from "../core/tokens";
import { Assembler } from "../core/assembler";
export class CompileError extends Error {
    constructor(message) {
        super(message);
        this.name = "CompileError";
    }
}
export class HardwareCompiler {
    variables = new Map();
    nextVarAddress = 0;
    labelCounter = 0;
    scratchDepth = 0;
    lowestScratchAddress = 256;
    // Group related operators into constants for better maintainability
    static COMPARISON_OPERATORS = new Set([
        Token.GREATER,
        Token.GREATER_EQUAL,
        Token.LESS,
        Token.LESS_EQUAL,
        Token.EQUAL_EQUAL,
    ]);
    compileToAssembly(statements) {
        this.variables.clear();
        this.nextVarAddress = 0;
        this.labelCounter = 0;
        this.scratchDepth = 0;
        this.lowestScratchAddress = 256;
        // Generate assembly code
        const assemblyLines = [];
        for (const stmt of statements) {
            assemblyLines.push(...stmt.accept(this));
        }
        assemblyLines.push("halt");
        return assemblyLines;
    }
    compileToBytecode(assembly) {
        const assembler = new Assembler();
        const bytecode = assembler.assemble(assembly);
        // Convert to final numeric bytecode with resolved labels
        const resolvedBytecode = assembler.hexOutput(bytecode);
        if (resolvedBytecode.length === 0) {
            throw new CompileError("Failed to resolve all labels in the bytecode");
        }
        return resolvedBytecode;
    }
    createLabel() {
        return `L${this.labelCounter++}`;
    }
    /**
     * Reserve compiler-owned cells at the top of RAM page 0.  Spilling operands
     * makes nested expressions reliable on a four-register machine and leaves
     * the registers free for builtins such as peek/poke.
     */
    withScratch(count, callback) {
        const startDepth = this.scratchDepth;
        const addresses = Array.from({ length: count }, (_, index) => 255 - startDepth - index);
        const lowest = addresses[addresses.length - 1] ?? 256;
        if (lowest < this.nextVarAddress) {
            throw new CompileError("Program needs more than 256 variable and temporary RAM cells");
        }
        this.scratchDepth += count;
        this.lowestScratchAddress = Math.min(this.lowestScratchAddress, lowest);
        try {
            return callback(addresses);
        }
        finally {
            this.scratchDepth = startDepth;
        }
    }
    /** Emit a literal or page-0 variable directly into a chosen register. */
    compileSimpleOperand(expr, register) {
        if (expr instanceof Grouping) {
            return this.compileSimpleOperand(expr.expression, register);
        }
        if (expr instanceof LiteralNumber) {
            if (expr.val < 0 || expr.val > 255) {
                throw new CompileError("Number out of range (0-255)");
            }
            if (register === "a" && expr.val === 0)
                return ["opp 0"];
            if (register === "a" && expr.val === 1)
                return ["opp 1"];
            return [`load rom ${register} ${expr.val}`];
        }
        if (expr instanceof LiteralBool) {
            if (register === "a")
                return [`opp ${expr.val ? 1 : 0}`];
            return [`load rom ${register} ${expr.val ? 1 : 0}`];
        }
        if (expr instanceof Variable) {
            const address = this.variables.get(expr.name.value ?? "");
            if (address === undefined) {
                throw new CompileError(`Undefined variable: ${expr.name.value}`);
            }
            return [`load ram[${address}] ${register}`];
        }
        return undefined;
    }
    literalValue(expr) {
        if (expr instanceof Grouping)
            return this.literalValue(expr.expression);
        if (expr instanceof LiteralNumber)
            return expr.val;
        if (expr instanceof LiteralBool)
            return expr.val ? 1 : 0;
        return undefined;
    }
    visit(expr) {
        return expr.accept(this);
    }
    visitBinary(expr) {
        if (HardwareCompiler.COMPARISON_OPERATORS.has(expr.op)) {
            return this.handleComparison(expr);
        }
        return this.handleBinary(expr);
    }
    handleComparison(expr) {
        // Keep both operands out of `a`: `opp 0` initializes the false result and
        // the silicon's comparison instruction does not change `a`.
        const left = this.compileSimpleOperand(expr.left, "b");
        const right = this.compileSimpleOperand(expr.right, "c");
        if (left && right) {
            return this.finishComparison([...left, ...right, "opp 0", "cmp b c"], expr.op);
        }
        return this.withScratch(1, ([leftAddress]) => {
            const result = [
                ...expr.left.accept(this),
                `save a ram[${leftAddress}]`,
                ...expr.right.accept(this),
                "mov a c",
                `load ram[${leftAddress}] b`,
                "opp 0",
                "cmp b c",
            ];
            return this.finishComparison(result, expr.op);
        });
    }
    finishComparison(result, operator) {
        const skipLabel = this.createLabel();
        const jumpMap = {
            [Token.GREATER]: "<=",
            [Token.GREATER_EQUAL]: "<",
            [Token.LESS]: ">=",
            [Token.LESS_EQUAL]: ">",
            [Token.EQUAL_EQUAL]: "!=",
        };
        result.push(`jmp ${jumpMap[operator]} ${skipLabel}`, "opp 1", `:${skipLabel}`);
        return result;
    }
    handleBinary(expr) {
        const opMap = {
            [Token.PLUS]: "a+b",
            [Token.MINUS]: "a-b",
            [Token.STAR]: "a*b",
            [Token.SLASH]: "a/b",
            [Token.AND]: "a&b",
            [Token.OR]: "a|b",
        };
        if (opMap[expr.op] === undefined) {
            throw new CompileError(`Unknown binary operator: ${expr.op}`);
        }
        const left = this.compileSimpleOperand(expr.left, "a");
        const right = this.compileSimpleOperand(expr.right, "b");
        if (left && right) {
            return [...left, ...right, `opp ${opMap[expr.op]}`];
        }
        return this.withScratch(1, ([leftAddress]) => [
            ...expr.left.accept(this),
            `save a ram[${leftAddress}]`,
            ...expr.right.accept(this),
            "mov a b",
            `load ram[${leftAddress}] a`,
            `opp ${opMap[expr.op]}`,
        ]);
    }
    visitGrouping(expr) {
        return expr.expression.accept(this);
    }
    visitUnary(expr) {
        const result = expr.right.accept(this);
        switch (expr.op) {
            case Token.MINUS:
                result.push("opp -a");
                break;
            case Token.TILDE:
                result.push("opp ~a");
                break;
            case Token.BANG: {
                // !a  ->  (a == 0) ? 1 : 0.  `opp a` is identity but latches the zero
                // flag from a (unlike `cmp a 0`, which does not latch - errata E1), so
                // branch on it *before* clobbering a with the 0/1 result.
                const zeroLabel = this.createLabel();
                const endLabel = this.createLabel();
                result.push("opp a");
                result.push(`jmp = ${zeroLabel}`);
                result.push("opp 0");
                result.push(`jmp ${endLabel}`);
                result.push(`:${zeroLabel}`);
                result.push("opp 1");
                result.push(`:${endLabel}`);
                break;
            }
        }
        return result;
    }
    visitLiteralBool(expr) {
        return [`opp ${expr.val ? 1 : 0}`];
    }
    visitLiteralString(_expr) {
        throw new CompileError("String literals not supported in hardware implementation");
    }
    visitLiteralNumber(expr) {
        if (expr.val < 0 || expr.val > 255) {
            throw new CompileError("Number out of range (0-255)");
        }
        if (expr.val === 0) {
            return ["opp 0"];
        }
        else if (expr.val === 1) {
            return ["opp 1"];
        }
        else if (expr.val === -1) {
            return ["opp -1"];
        }
        return [`load rom a ${expr.val}`];
    }
    visitInput(_expr) {
        return [`in a`];
    }
    visitVariable(expr) {
        const address = this.variables.get(expr.name.value ?? "");
        if (address === undefined) {
            throw new CompileError(`Undefined variable: ${expr.name.value}`);
        }
        return [`load ram[${address}] a`];
    }
    visitAssign(expr) {
        const result = expr.value.accept(this);
        const address = this.variables.get(expr.name.value ?? "");
        if (address === undefined) {
            throw new CompileError(`Undefined variable: ${expr.name.value}`);
        }
        result.push(`save a ram[${address}]`);
        return result;
    }
    visitLogical(expr) {
        const endLabel = this.createLabel();
        const result = expr.left.accept(this);
        if (expr.op === Token.AND_AND) {
            // `opp a` latches the zero flag from a; `cmp a 0` does not (errata E1).
            result.push("opp a", `jmp = ${endLabel}`);
        }
        else if (expr.op === Token.OR_OR) {
            result.push("opp a", `jmp != ${endLabel}`);
        }
        else {
            throw new CompileError(`Unknown logical operator: ${expr.op}`);
        }
        result.push(...expr.right.accept(this), `:${endLabel}`);
        return result;
    }
    visitCall(expr) {
        const callee = expr.callee;
        const name = callee instanceof Variable ? callee.name.value : undefined;
        // peek(page, offset) - indexed read of external RAM at {page, offset}.
        // JRP has no arrays, so this is the primitive for reading a data image
        // (e.g. an animation flashed at 0x10000). It selects the RAM page, reads
        // the byte, then restores the page to 0 so ordinary variables (which live
        // on page 0) keep working. Result is left in `a` like any expression.
        if (name === "peek") {
            if (expr.args.length !== 2) {
                throw new CompileError("peek(page, offset) takes exactly 2 arguments");
            }
            const page = this.compileSimpleOperand(expr.args[0], "a");
            const offset = this.compileSimpleOperand(expr.args[1], "b");
            if (page && offset) {
                if (this.literalValue(expr.args[0]) === 0) {
                    return [...offset, "load ram[b] a"];
                }
                return [
                    ...offset,
                    ...page,
                    "set a rampage",
                    "load ram[b] d",
                    "opp 0",
                    "set a rampage",
                    "mov d a",
                ];
            }
            return this.withScratch(2, ([pageAddress, offsetAddress]) => [
                ...expr.args[0].accept(this),
                `save a ram[${pageAddress}]`,
                ...expr.args[1].accept(this),
                `save a ram[${offsetAddress}]`,
                `load ram[${offsetAddress}] b`,
                `load ram[${pageAddress}] a`,
                "set a rampage",
                "load ram[b] d",
                "opp 0",
                "set a rampage",
                "mov d a",
            ]);
        }
        // poke(page, offset, value) writes an indexed byte and returns value.
        if (name === "poke") {
            if (expr.args.length !== 3) {
                throw new CompileError("poke(page, offset, value) takes exactly 3 arguments");
            }
            const page = this.compileSimpleOperand(expr.args[0], "a");
            const offset = this.compileSimpleOperand(expr.args[1], "b");
            const value = this.compileSimpleOperand(expr.args[2], "d");
            if (page && offset && value) {
                if (this.literalValue(expr.args[0]) === 0) {
                    const valueInA = this.compileSimpleOperand(expr.args[2], "a");
                    return [...offset, ...(valueInA ?? []), "save b mar", "save a ram[current]"];
                }
                return [
                    ...offset,
                    ...value,
                    ...page,
                    "set a rampage",
                    "save b mar",
                    "save d ram[current]",
                    "opp 0",
                    "set a rampage",
                    "mov d a",
                ];
            }
            return this.withScratch(3, ([pageAddress, offsetAddress, valueAddress]) => [
                ...expr.args[0].accept(this),
                `save a ram[${pageAddress}]`,
                ...expr.args[1].accept(this),
                `save a ram[${offsetAddress}]`,
                ...expr.args[2].accept(this),
                `save a ram[${valueAddress}]`,
                `load ram[${offsetAddress}] b`,
                `load ram[${valueAddress}] d`,
                `load ram[${pageAddress}] a`,
                "set a rampage",
                "save b mar",
                "save d ram[current]",
                "opp 0",
                "set a rampage",
                `load ram[${valueAddress}] a`,
            ]);
        }
        // i2c8(value) bit-bangs one MSB-first I2C byte on output pins 0 (SDA)
        // and 1 (SCL), followed by an ACK clock. Keeping this loop in the code
        // generator avoids RAM-backed shift and counter variables in the hot path.
        if (name === "i2c8") {
            if (expr.args.length !== 1) {
                throw new CompileError("i2c8(value) takes exactly 1 argument");
            }
            const simpleValue = this.compileSimpleOperand(expr.args[0], "b");
            const result = simpleValue ?? [...expr.args[0].accept(this), "mov a b"];
            for (let bit = 7; bit >= 0; bit--) {
                const zeroLabel = this.createLabel();
                const endLabel = this.createLabel();
                result.push(`load rom a ${1 << bit}`, "opp a&b", `jmp = ${zeroLabel}`);
                result.push("out 0b01", "out 0b11", "out 0b01", `jmp ${endLabel}`);
                result.push(`:${zeroLabel}`, "out 0b00", "out 0b10", "out 0b00", `:${endLabel}`);
            }
            result.push("out 0b01", "out 0b11", "out 0b01");
            return result;
        }
        throw new CompileError(`Unknown function: ${name ?? "<expression>"}`);
    }
    visitExpressionStmt(stmt) {
        return stmt.expression.accept(this);
    }
    visitIfStmt(stmt) {
        const result = stmt.condition.accept(this);
        const elseLabel = this.createLabel();
        const endLabel = this.createLabel();
        // `opp a` latches the zero flag from a; `cmp a 0` does not (errata E1).
        result.push("opp a", `jmp = ${elseLabel}`);
        result.push(...stmt.thenBranch.accept(this));
        result.push(`jmp ${endLabel}`);
        result.push(`:${elseLabel}`);
        if (stmt.elseBranch) {
            result.push(...stmt.elseBranch.accept(this));
        }
        result.push(`:${endLabel}`);
        return result;
    }
    // Combine similar loop handling logic
    compileLoopBody(condition, body, increment = null) {
        const startLabel = this.createLabel();
        const endLabel = this.createLabel();
        const result = [];
        result.push(`:${startLabel}`);
        if (condition) {
            // `opp a` latches the zero flag from a; `cmp a 0` does not (errata E1).
            result.push(...condition.accept(this), "opp a", `jmp = ${endLabel}`);
        }
        result.push(...body.accept(this));
        if (increment) {
            result.push(...increment.accept(this));
        }
        result.push(`jmp ${startLabel}`, `:${endLabel}`);
        return result;
    }
    visitWhileStmt(stmt) {
        return this.compileLoopBody(stmt.condition, stmt.body);
    }
    visitForStmt(stmt) {
        const result = [];
        if (stmt.initializer) {
            result.push(...stmt.initializer.accept(this));
        }
        result.push(...this.compileLoopBody(stmt.condition, stmt.body, stmt.increment));
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
        if (this.nextVarAddress >= this.lowestScratchAddress) {
            throw new CompileError("Program needs more than 256 variable and temporary RAM cells");
        }
        const address = this.nextVarAddress++;
        this.variables.set(varName, address);
        if (stmt.initializer) {
            result.push(...stmt.initializer.accept(this), `save a ram[${address}]`);
        }
        return result;
    }
    visitFunctionStmt(_stmt) {
        throw new CompileError("Functions not yet implemented for hardware");
    }
    visitReturnStmt(_stmt) {
        throw new CompileError("Return not yet implemented for hardware");
    }
    visitOutputStmt(stmt) {
        const result = stmt.expression.accept(this);
        result.push("out a");
        return result;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGFyZHdhcmVfY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvdm0vaGFyZHdhcmVfY29tcGlsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUlMLFFBQVEsRUFFUixXQUFXLEVBRVgsYUFBYSxFQUNiLFFBQVEsR0FLVCxNQUFNLG9CQUFvQixDQUFDO0FBYzVCLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUN2QyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFFOUMsTUFBTSxPQUFPLFlBQWEsU0FBUSxLQUFLO0lBQ3JDLFlBQVksT0FBZTtRQUN6QixLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDZixJQUFJLENBQUMsSUFBSSxHQUFHLGNBQWMsQ0FBQztJQUM3QixDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sZ0JBQWdCO0lBQ1YsU0FBUyxHQUF3QixJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQ3BELGNBQWMsR0FBVyxDQUFDLENBQUM7SUFDM0IsWUFBWSxHQUFXLENBQUMsQ0FBQztJQUN6QixZQUFZLEdBQVcsQ0FBQyxDQUFDO0lBQ3pCLG9CQUFvQixHQUFXLEdBQUcsQ0FBQztJQUUzQyxvRUFBb0U7SUFDNUQsTUFBTSxDQUFVLG9CQUFvQixHQUFHLElBQUksR0FBRyxDQUFDO1FBQ3JELEtBQUssQ0FBQyxPQUFPO1FBQ2IsS0FBSyxDQUFDLGFBQWE7UUFDbkIsS0FBSyxDQUFDLElBQUk7UUFDVixLQUFLLENBQUMsVUFBVTtRQUNoQixLQUFLLENBQUMsV0FBVztLQUNsQixDQUFDLENBQUM7SUFFSCxpQkFBaUIsQ0FBQyxVQUFrQjtRQUNsQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxjQUFjLEdBQUcsQ0FBQyxDQUFDO1FBQ3hCLElBQUksQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDO1FBQ3RC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