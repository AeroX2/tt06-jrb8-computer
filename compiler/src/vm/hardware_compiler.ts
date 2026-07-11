import {
  Expr,
  ExprVisitor,
  Binary,
  Grouping,
  Unary,
  LiteralBool,
  LiteralString,
  LiteralNumber,
  Variable,
  Assign,
  Logical,
  Call,
  Input,
} from "../ast/expressions";
import {
  Stmt,
  StmtVisitor,
  Expression,
  If,
  While,
  For,
  Block,
  Var,
  Function,
  Return,
  Output,
} from "../ast/statements";
import { Token } from "../core/tokens";
import { Assembler } from "../core/assembler";

export class CompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompileError";
  }
}

export class HardwareCompiler implements ExprVisitor<string[]>, StmtVisitor<string[]> {
  private readonly variables: Map<string, number> = new Map();
  private nextVarAddress: number = 0;
  private labelCounter: number = 0;
  private scratchDepth: number = 0;
  private lowestScratchAddress: number = 256;

  // Group related operators into constants for better maintainability
  private static readonly COMPARISON_OPERATORS = new Set([
    Token.GREATER,
    Token.GREATER_EQUAL,
    Token.LESS,
    Token.LESS_EQUAL,
    Token.EQUAL_EQUAL,
  ]);

  compileToAssembly(statements: Stmt[]): string[] {
    this.variables.clear();
    this.nextVarAddress = 0;
    this.labelCounter = 0;
    this.scratchDepth = 0;
    this.lowestScratchAddress = 256;

    // Generate assembly code
    const assemblyLines: string[] = [];
    for (const stmt of statements) {
      assemblyLines.push(...stmt.accept(this));
    }
    assemblyLines.push("halt");
    return assemblyLines;
  }

  compileToBytecode(assembly: string[]): number[] {
    const assembler = new Assembler();
    const bytecode = assembler.assemble(assembly);

    // Convert to final numeric bytecode with resolved labels
    const resolvedBytecode = assembler.hexOutput(bytecode);
    if (resolvedBytecode.length === 0) {
      throw new CompileError("Failed to resolve all labels in the bytecode");
    }

    return resolvedBytecode;
  }

  private createLabel(): string {
    return `L${this.labelCounter++}`;
  }

  /**
   * Reserve compiler-owned cells at the top of RAM page 0.  Spilling operands
   * makes nested expressions reliable on a four-register machine and leaves
   * the registers free for builtins such as peek/poke.
   */
  private withScratch<T>(count: number, callback: (addresses: number[]) => T): T {
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
    } finally {
      this.scratchDepth = startDepth;
    }
  }

  /** Emit a literal or page-0 variable directly into a chosen register. */
  private compileSimpleOperand(expr: Expr, register: "a" | "b" | "c" | "d"): string[] | undefined {
    if (expr instanceof Grouping) {
      return this.compileSimpleOperand(expr.expression, register);
    }
    if (expr instanceof LiteralNumber) {
      if (expr.val < 0 || expr.val > 255) {
        throw new CompileError("Number out of range (0-255)");
      }
      if (register === "a" && expr.val === 0) return ["opp 0"];
      if (register === "a" && expr.val === 1) return ["opp 1"];
      return [`load rom ${register} ${expr.val}`];
    }
    if (expr instanceof LiteralBool) {
      if (register === "a") return [`opp ${expr.val ? 1 : 0}`];
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

  private literalValue(expr: Expr): number | undefined {
    if (expr instanceof Grouping) return this.literalValue(expr.expression);
    if (expr instanceof LiteralNumber) return expr.val;
    if (expr instanceof LiteralBool) return expr.val ? 1 : 0;
    return undefined;
  }

  visit(expr: Expr): string[] {
    return expr.accept(this);
  }

  visitBinary(expr: Binary): string[] {
    if (HardwareCompiler.COMPARISON_OPERATORS.has(expr.op)) {
      return this.handleComparison(expr);
    }
    return this.handleBinary(expr);
  }

  private handleComparison(expr: Binary): string[] {
    // Keep both operands out of `a`: `opp 0` initializes the false result and
    // the silicon's comparison instruction does not change `a`.
    const left = this.compileSimpleOperand(expr.left, "b");
    const right = this.compileSimpleOperand(expr.right, "c");
    if (left && right) {
      return this.finishComparison([...left, ...right, "opp 0", "cmp b c"], expr.op);
    }
    return this.withScratch(1, ([leftAddress]) => {
      const result: string[] = [
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

  private finishComparison(result: string[], operator: Token): string[] {
    const skipLabel = this.createLabel();
    const jumpMap: Partial<Record<Token, string>> = {
      [Token.GREATER]: "<=",
      [Token.GREATER_EQUAL]: "<",
      [Token.LESS]: ">=",
      [Token.LESS_EQUAL]: ">",
      [Token.EQUAL_EQUAL]: "!=",
    };
    result.push(`jmp ${jumpMap[operator]} ${skipLabel}`, "opp 1", `:${skipLabel}`);
    return result;
  }

  private handleBinary(expr: Binary): string[] {
    const opMap: Partial<Record<Token, string>> = {
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

  visitGrouping(expr: Grouping): string[] {
    return expr.expression.accept(this);
  }

  visitUnary(expr: Unary): string[] {
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

  visitLiteralBool(expr: LiteralBool): string[] {
    return [`opp ${expr.val ? 1 : 0}`];
  }

  visitLiteralString(_expr: LiteralString): string[] {
    throw new CompileError("String literals not supported in hardware implementation");
  }

  visitLiteralNumber(expr: LiteralNumber): string[] {
    if (expr.val < 0 || expr.val > 255) {
      throw new CompileError("Number out of range (0-255)");
    }
    if (expr.val === 0) {
      return ["opp 0"];
    } else if (expr.val === 1) {
      return ["opp 1"];
    } else if (expr.val === -1) {
      return ["opp -1"];
    }
    return [`load rom a ${expr.val}`];
  }

  visitInput(_expr: Input): string[] {
    return [`in a`];
  }

  visitVariable(expr: Variable): string[] {
    const address = this.variables.get(expr.name.value ?? "");
    if (address === undefined) {
      throw new CompileError(`Undefined variable: ${expr.name.value}`);
    }
    return [`load ram[${address}] a`];
  }

  visitAssign(expr: Assign): string[] {
    const result = expr.value.accept(this);
    const address = this.variables.get(expr.name.value ?? "");
    if (address === undefined) {
      throw new CompileError(`Undefined variable: ${expr.name.value}`);
    }
    result.push(`save a ram[${address}]`);
    return result;
  }

  visitLogical(expr: Logical): string[] {
    const endLabel = this.createLabel();
    const result = expr.left.accept(this);

    if (expr.op === Token.AND_AND) {
      // `opp a` latches the zero flag from a; `cmp a 0` does not (errata E1).
      result.push("opp a", `jmp = ${endLabel}`);
    } else if (expr.op === Token.OR_OR) {
      result.push("opp a", `jmp != ${endLabel}`);
    } else {
      throw new CompileError(`Unknown logical operator: ${expr.op}`);
    }

    result.push(...expr.right.accept(this), `:${endLabel}`);
    return result;
  }

  visitCall(expr: Call): string[] {
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

  visitExpressionStmt(stmt: Expression): string[] {
    return stmt.expression.accept(this);
  }

  visitIfStmt(stmt: If): string[] {
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
  private compileLoopBody(
    condition: Expr | null,
    body: Stmt,
    increment: Expr | null = null
  ): string[] {
    const startLabel = this.createLabel();
    const endLabel = this.createLabel();
    const result: string[] = [];

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

  visitWhileStmt(stmt: While): string[] {
    return this.compileLoopBody(stmt.condition, stmt.body);
  }

  visitForStmt(stmt: For): string[] {
    const result: string[] = [];
    if (stmt.initializer) {
      result.push(...stmt.initializer.accept(this));
    }
    result.push(...this.compileLoopBody(stmt.condition, stmt.body, stmt.increment));
    return result;
  }

  visitBlockStmt(stmt: Block): string[] {
    const result: string[] = [];
    for (const statement of stmt.statements) {
      result.push(...statement.accept(this));
    }
    return result;
  }

  visitVarStmt(stmt: Var): string[] {
    const result: string[] = [];
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

  visitFunctionStmt(_stmt: Function): string[] {
    throw new CompileError("Functions not yet implemented for hardware");
  }

  visitReturnStmt(_stmt: Return): string[] {
    throw new CompileError("Return not yet implemented for hardware");
  }

  visitOutputStmt(stmt: Output): string[] {
    const result = stmt.expression.accept(this);
    result.push("out a");
    return result;
  }
}
