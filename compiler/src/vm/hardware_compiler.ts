import { 
  Expr, ExprVisitor, Binary, Grouping, Unary, LiteralBool,
  LiteralString, LiteralNumber, Variable, Assign, Logical, Call
} from '../ast/expressions';
import {
  Stmt, StmtVisitor, Expression, If, While, For,
  Block, Var, Function, Return, Output
} from '../ast/statements';
import { Token } from '../core/tokens';
import { Assembler } from '../core/assembler';

export class CompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompileError';
  }
}

export class HardwareCompiler implements ExprVisitor<string[]>, StmtVisitor<string[]> {
  private variables: Map<string, number> = new Map();
  private nextVarAddress: number = 0;
  private labelCounter: number = 0;

  // Group related operators into constants for better maintainability
  private static readonly COMPARISON_OPERATORS = new Set([
    Token.GREATER, Token.GREATER_EQUAL, Token.LESS,
    Token.LESS_EQUAL, Token.EQUAL_EQUAL
  ]);

  private static readonly RIGHT_EVAL_FIRST_OPERATORS = new Set([
    Token.MINUS, Token.SLASH
  ]);

  compileToAssembly(statements: Stmt[]): string[] {
    this.variables.clear();
    this.nextVarAddress = 0;
    this.labelCounter = 0;

    // Generate assembly code
    const assemblyLines: string[] = [];
    for (const stmt of statements) {
      assemblyLines.push(...stmt.accept(this));
    }
    assemblyLines.push('halt');
    return assemblyLines;
  }

  compileToBytecode(assembly: string[]): number[] {
    const assembler = new Assembler();
    const bytecode = assembler.assemble(assembly);

    // Convert to final numeric bytecode with resolved labels
    const resolvedBytecode = assembler.hexOutput(bytecode);
    if (resolvedBytecode.length === 0) {
      throw new CompileError('Failed to resolve all labels in the bytecode');
    }
    
    return resolvedBytecode;
  }

  private createLabel(): string {
    return `L${this.labelCounter++}`;
  }

  visit(expr: Expr): string[] {
    return expr.accept(this);
  }

  visitBinary(expr: Binary): string[] {
    if (HardwareCompiler.COMPARISON_OPERATORS.has(expr.op)) {
      return this.handleComparison(expr);
    } else if (HardwareCompiler.RIGHT_EVAL_FIRST_OPERATORS.has(expr.op)) {
      return this.handleRightFirst(expr);
    } else {
      return this.handleLeftFirst(expr);
    }
  }

  private handleComparison(expr: Binary): string[] {
    const result: string[] = [];
    result.push(
      ...expr.left.accept(this),
      'mov a b',
      ...expr.right.accept(this),
      'cmp b a'
    );
    
    const skipLabel = this.createLabel();
    result.push('load rom a 0');
    
    const jumpMap: Partial<Record<Token, string>> = {
      [Token.GREATER]: '<=',
      [Token.GREATER_EQUAL]: '<',
      [Token.LESS]: '>=',
      [Token.LESS_EQUAL]: '>',
      [Token.EQUAL_EQUAL]: '!='
    };
    
    result.push(`jmp ${jumpMap[expr.op]} ${skipLabel}`);
    result.push('load rom a 1', `:${skipLabel}`);
    return result;
  }

  private handleRightFirst(expr: Binary): string[] {
    const result: string[] = [];
    result.push(
      ...expr.right.accept(this),
      'mov a b',
      ...expr.left.accept(this)
    );
    
    const opMap: Partial<Record<Token, string>> = {
      [Token.MINUS]: 'a-b',
      [Token.SLASH]: 'a/b'
    };
    
    result.push(`opp ${opMap[expr.op]}`);
    return result;
  }

  private handleLeftFirst(expr: Binary): string[] {
    const result: string[] = [];
    result.push(
      ...expr.left.accept(this),
      'mov a b',
      ...expr.right.accept(this)
    );
    
    const opMap: Partial<Record<Token, string>> = {
      [Token.PLUS]: 'a+b',
      [Token.STAR]: 'a*b'
    };
    
    if (!opMap[expr.op]) {
      throw new CompileError(`Unknown binary operator: ${expr.op}`);
    }
    
    result.push(`opp ${opMap[expr.op]}`);
    return result;
  }

  visitGrouping(expr: Grouping): string[] {
    return expr.expression.accept(this);
  }

  visitUnary(expr: Unary): string[] {
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

  visitLiteralBool(expr: LiteralBool): string[] {
    return [`load rom a ${expr.val ? 1 : 0}`];
  }

  visitLiteralString(expr: LiteralString): string[] {
    throw new CompileError("String literals not supported in hardware implementation");
  }

  visitLiteralNumber(expr: LiteralNumber): string[] {
    if (expr.val < 0 || expr.val > 255) {
      throw new CompileError("Number out of range (0-255)");
    }
    return [`load rom a ${expr.val}`];
  }

  visitVariable(expr: Variable): string[] {
    const address = this.variables.get(expr.name.value || '');
    if (address === undefined) {
      throw new CompileError(`Undefined variable: ${expr.name.value}`);
    }
    return [`load ram[${address}] a`];
  }

  visitAssign(expr: Assign): string[] {
    const result = expr.value.accept(this);
    const address = this.variables.get(expr.name.value || '');
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
      result.push(
        'cmp a 0',
        `jmp = ${endLabel}`
      );
    } else if (expr.op === Token.OR_OR) {
      result.push(
        'cmp a 0',
        `jmp != ${endLabel}`
      );
    } else {
      throw new CompileError(`Unknown logical operator: ${expr.op}`);
    }

    result.push(
      ...expr.right.accept(this),
      `:${endLabel}`
    );
    return result;
  }

  visitCall(expr: Call): string[] {
    throw new CompileError("Function calls not yet implemented for hardware");
  }

  visitExpressionStmt(stmt: Expression): string[] {
    return stmt.expression.accept(this);
  }

  visitIfStmt(stmt: If): string[] {
    const result = stmt.condition.accept(this);
    const elseLabel = this.createLabel();
    const endLabel = this.createLabel();

    result.push(
      'cmp a 0',
      `jmp = ${elseLabel}`
    );

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
      result.push(
        ...condition.accept(this),
        'cmp a 0',
        `jmp = ${endLabel}`
      );
    }

    result.push(...body.accept(this));
    
    if (increment) {
      result.push(...increment.accept(this));
    }

    result.push(
      `jmp ${startLabel}`,
      `:${endLabel}`
    );
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
    result.push(...this.compileLoopBody(
      stmt.condition,
      stmt.body,
      stmt.increment
    ));
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
    const address = this.nextVarAddress++;
    this.variables.set(varName, address);

    if (stmt.initializer) {
      result.push(
        ...stmt.initializer.accept(this),
        `save a ram[${address}]`
      );
    }

    return result;
  }

  visitFunctionStmt(stmt: Function): string[] {
    throw new CompileError("Functions not yet implemented for hardware");
  }

  visitReturnStmt(stmt: Return): string[] {
    throw new CompileError("Return not yet implemented for hardware");
  }

  visitOutputStmt(stmt: Output): string[] {
    const result = stmt.expression.accept(this);
    result.push('out a');
    return result;
  }
} 