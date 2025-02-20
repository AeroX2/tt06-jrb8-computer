import { Token, TokenObj } from "../core/tokens";

export interface ExprVisitor<T> {
  visit(expr: Expr): T;
  visitBinary(expr: Binary): T;
  visitGrouping(expr: Grouping): T;
  visitUnary(expr: Unary): T;
  visitLiteralBool(expr: LiteralBool): T;
  visitLiteralString(expr: LiteralString): T;
  visitLiteralNumber(expr: LiteralNumber): T;
  visitVariable(expr: Variable): T;
  visitAssign(expr: Assign): T;
  visitLogical(expr: Logical): T;
  visitInput(expr: Input): T;
  visitCall(expr: Call): T;
}

export abstract class Expr {
  abstract accept<T>(visitor: ExprVisitor<T>): T;
}

export class Binary extends Expr {
  constructor(
    public left: Expr,
    public op: Token,
    public right: Expr
  ) {
    super();
  }

  accept<T>(visitor: ExprVisitor<T>): T {
    return visitor.visitBinary(this);
  }
}

export class Grouping extends Expr {
  constructor(public expression: Expr) {
    super();
  }

  accept<T>(visitor: ExprVisitor<T>): T {
    return visitor.visitGrouping(this);
  }
}

export class Unary extends Expr {
  constructor(
    public op: Token,
    public right: Expr
  ) {
    super();
  }

  accept<T>(visitor: ExprVisitor<T>): T {
    return visitor.visitUnary(this);
  }
}

export class LiteralBool extends Expr {
  constructor(public val: boolean) {
    super();
  }

  accept<T>(visitor: ExprVisitor<T>): T {
    return visitor.visitLiteralBool(this);
  }
}

export class LiteralString extends Expr {
  constructor(public val: string) {
    super();
  }

  accept<T>(visitor: ExprVisitor<T>): T {
    return visitor.visitLiteralString(this);
  }
}

export class LiteralNumber extends Expr {
  constructor(public val: number) {
    super();
  }

  accept<T>(visitor: ExprVisitor<T>): T {
    return visitor.visitLiteralNumber(this);
  }
}

export class Variable extends Expr {
  constructor(public name: TokenObj) {
    super();
  }

  accept<T>(visitor: ExprVisitor<T>): T {
    return visitor.visitVariable(this);
  }
}

export class Assign extends Expr {
  constructor(
    public name: TokenObj,
    public value: Expr
  ) {
    super();
  }

  accept<T>(visitor: ExprVisitor<T>): T {
    return visitor.visitAssign(this);
  }
}

export class Logical extends Expr {
  constructor(
    public left: Expr,
    public op: Token,
    public right: Expr
  ) {
    super();
  }

  accept<T>(visitor: ExprVisitor<T>): T {
    return visitor.visitLogical(this);
  }
}

export class Call extends Expr {
  constructor(
    public callee: Expr,
    public paren: TokenObj,
    public args: Expr[]
  ) {
    super();
  }

  accept<T>(visitor: ExprVisitor<T>): T {
    return visitor.visitCall(this);
  }
}

export class Input extends Expr {
  constructor() {
    super();
  }

  accept<T>(visitor: ExprVisitor<T>): T {
    return visitor.visitInput(this);
  }
}
