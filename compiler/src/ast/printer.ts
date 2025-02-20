import { ExprVisitor, Input } from "./expressions";
import { StmtVisitor } from "./statements";
import {
  Expr,
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
} from "./expressions";
import { Expression, If, While, For, Block, Var, Function, Return, Output } from "./statements";

export class ASTPrinter implements ExprVisitor<string>, StmtVisitor<string> {
  visit(expr: Expr): string {
    return expr.accept(this);
  }

  visitBinary(expr: Binary): string {
    return `[${expr.left.accept(this)} ${expr.op} ${expr.right.accept(this)}]`;
  }

  visitGrouping(expr: Grouping): string {
    return `(${expr.expression.accept(this)})`;
  }

  visitUnary(expr: Unary): string {
    return `${expr.op}(${expr.right.accept(this)})`;
  }

  visitLiteralBool(expr: LiteralBool): string {
    return `${expr.val}`;
  }

  visitLiteralString(expr: LiteralString): string {
    return `"${expr.val}"`;
  }

  visitLiteralNumber(expr: LiteralNumber): string {
    return `${expr.val}`;
  }

  visitVariable(expr: Variable): string {
    return expr.name.value ?? "";
  }

  visitAssign(expr: Assign): string {
    return `${expr.name.value} = ${expr.value.accept(this)}`;
  }

  visitLogical(expr: Logical): string {
    return `[${expr.left.accept(this)} ${expr.op} ${expr.right.accept(this)}]`;
  }

  visitInput(_expr: Input): string {
    return `in`;
  }

  visitCall(expr: Call): string {
    const args = expr.args.map(arg => arg.accept(this)).join(", ");
    return `${expr.callee.accept(this)}(${args})`;
  }

  visitExpressionStmt(stmt: Expression): string {
    return stmt.expression.accept(this);
  }

  visitIfStmt(stmt: If): string {
    let result = `if (${stmt.condition.accept(this)}) {\n  ${stmt.thenBranch.accept(this)}\n}`;
    if (stmt.elseBranch) {
      result += ` else {\n  ${stmt.elseBranch.accept(this)}\n}`;
    }
    return result;
  }

  visitWhileStmt(stmt: While): string {
    return `while (${stmt.condition.accept(this)}) {\n  ${stmt.body.accept(this)}\n}`;
  }

  visitForStmt(stmt: For): string {
    const init = stmt.initializer ? stmt.initializer.accept(this) : "";
    const cond = stmt.condition ? stmt.condition.accept(this) : "";
    const inc = stmt.increment ? stmt.increment.accept(this) : "";
    return `for (${init} ${cond} ${inc}) {\n  ${stmt.body.accept(this)}\n}`;
  }

  visitBlockStmt(stmt: Block): string {
    return stmt.statements.map(s => s.accept(this)).join("\n  ");
  }

  visitVarStmt(stmt: Var): string {
    const init = stmt.initializer ? ` = ${stmt.initializer.accept(this)}` : "";
    return `var ${stmt.name}${init}`;
  }

  visitFunctionStmt(stmt: Function): string {
    const params = stmt.params.join(", ");
    const body = stmt.body.map(s => s.accept(this)).join("\n  ");
    return `fun ${stmt.name}(${params}) {\n  ${body}\n}`;
  }

  visitReturnStmt(stmt: Return): string {
    const value = stmt.value ? ` ${stmt.value.accept(this)}` : "";
    return `return${value}`;
  }

  visitOutputStmt(stmt: Output): string {
    return `out ${stmt.expression.accept(this)}`;
  }
}
