import { Expr } from './expressions';

export interface StmtVisitor<T> {
  visitExpressionStmt(stmt: Expression): T;
  visitIfStmt(stmt: If): T;
  visitWhileStmt(stmt: While): T;
  visitForStmt(stmt: For): T;
  visitBlockStmt(stmt: Block): T;
  visitVarStmt(stmt: Var): T;
  visitFunctionStmt(stmt: Function): T;
  visitReturnStmt(stmt: Return): T;
  visitOutputStmt(stmt: Output): T;
}

export abstract class Stmt {
  abstract accept<T>(visitor: StmtVisitor<T>): T;
}

export class Expression extends Stmt {
  constructor(public expression: Expr) {
    super();
  }

  accept<T>(visitor: StmtVisitor<T>): T {
    return visitor.visitExpressionStmt(this);
  }
}

export class If extends Stmt {
  constructor(
    public condition: Expr,
    public thenBranch: Stmt,
    public elseBranch: Stmt | null
  ) {
    super();
  }

  accept<T>(visitor: StmtVisitor<T>): T {
    return visitor.visitIfStmt(this);
  }
}

export class While extends Stmt {
  constructor(
    public condition: Expr,
    public body: Stmt
  ) {
    super();
  }

  accept<T>(visitor: StmtVisitor<T>): T {
    return visitor.visitWhileStmt(this);
  }
}

export class For extends Stmt {
  constructor(
    public initializer: Stmt | null,
    public condition: Expr | null,
    public increment: Expr | null,
    public body: Stmt
  ) {
    super();
  }

  accept<T>(visitor: StmtVisitor<T>): T {
    return visitor.visitForStmt(this);
  }
}

export class Block extends Stmt {
  constructor(public statements: Stmt[]) {
    super();
  }

  accept<T>(visitor: StmtVisitor<T>): T {
    return visitor.visitBlockStmt(this);
  }
}

export class Var extends Stmt {
  constructor(
    public name: string,
    public initializer: Expr | null
  ) {
    super();
  }

  accept<T>(visitor: StmtVisitor<T>): T {
    return visitor.visitVarStmt(this);
  }
}

export class Function extends Stmt {
  constructor(
    public name: string,
    public params: string[],
    public body: Stmt[]
  ) {
    super();
  }

  accept<T>(visitor: StmtVisitor<T>): T {
    return visitor.visitFunctionStmt(this);
  }
}

export class Return extends Stmt {
  constructor(public value: Expr | null) {
    super();
  }

  accept<T>(visitor: StmtVisitor<T>): T {
    return visitor.visitReturnStmt(this);
  }
}

export class Output extends Stmt {
  constructor(public expression: Expr) {
    super();
  }

  accept<T>(visitor: StmtVisitor<T>): T {
    return visitor.visitOutputStmt(this);
  }
} 