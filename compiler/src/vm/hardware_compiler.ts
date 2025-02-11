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

  compile(statements: Stmt[]): number[] {
    this.variables.clear();
    this.nextVarAddress = 0;
    this.labelCounter = 0;

    // Generate assembly code
    const assemblyLines: string[] = [];
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

  private createLabel(): string {
    return `L${this.labelCounter++}`;
  }

  visit(expr: Expr): string[] {
    return expr.accept(this);
  }

  visitBinary(expr: Binary): string[] {
    const result: string[] = [];
    
    // For subtraction, evaluate right operand first
    if (expr.op === Token.MINUS) {
      result.push(...expr.right.accept(this));
      result.push('mov a b');
      result.push(...expr.left.accept(this));
      result.push('opp a-b');
    } else {
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
    if (expr.op === Token.AND_AND) {
      const endLabel = this.createLabel();
      const result = expr.left.accept(this);
      result.push(
        'cmp a 0',
        `jmp = ${endLabel}`
      );
      result.push(...expr.right.accept(this));
      result.push(`:${endLabel}`);
      return result;
    } else if (expr.op === Token.OR_OR) {
      const endLabel = this.createLabel();
      const result = expr.left.accept(this);
      result.push(
        'cmp a 0',
        `jmp != ${endLabel}`
      );
      result.push(...expr.right.accept(this));
      result.push(`:${endLabel}`);
      return result;
    }
    throw new CompileError(`Unknown logical operator: ${expr.op}`);
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

  visitWhileStmt(stmt: While): string[] {
    const startLabel = this.createLabel();
    const endLabel = this.createLabel();
    const result: string[] = [];
    
    result.push(`:${startLabel}`);
    result.push(...stmt.condition.accept(this));
    result.push(
      'cmp a 0',
      `jmp = ${endLabel}`
    );
    
    result.push(...stmt.body.accept(this));
    result.push(`jmp ${startLabel}`);
    
    result.push(`:${endLabel}`);
    return result;
  }

  visitForStmt(stmt: For): string[] {
    const result: string[] = [];
    if (stmt.initializer) {
      result.push(...stmt.initializer.accept(this));
    }

    const startLabel = this.createLabel();
    const endLabel = this.createLabel();
    const incrementLabel = this.createLabel();

    result.push(`:${startLabel}`);
    if (stmt.condition) {
      result.push(...stmt.condition.accept(this));
      result.push(
        'cmp a 0',
        `jmp = ${endLabel}`
      );
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