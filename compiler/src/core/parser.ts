import { Token, TokenObj } from './tokens';
import {
  Expr, Binary, Grouping, Unary, LiteralBool,
  LiteralString, LiteralNumber, Variable, Assign, Logical, Call
} from '../ast/expressions';
import {
  Stmt, Expression, If, While, For, Block, Var, Function, Return, Output
} from '../ast/statements';
import { ASTPrinter } from '../ast/printer';

export class ParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParserError';
  }
}

export class Parser {
  private tokens: TokenObj[];
  private current = 0;

  constructor(tokens: TokenObj[]) {
    this.tokens = tokens;
  }

  private peek(): TokenObj {
    return this.tokens[this.current];
  }

  private previous(): TokenObj {
    return this.tokens[this.current - 1];
  }

  private isAtEnd(): boolean {
    return this.peek().token === Token.EOF;
  }

  private advance(): TokenObj {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private check(type: Token): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().token === type;
  }

  private match(...types: Token[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private consume(type: Token, message: string): TokenObj {
    if (this.check(type)) return this.advance();
    throw new ParserError(message);
  }

  public parse(): Stmt[] {
    const statements: Stmt[] = [];
    while (!this.isAtEnd()) {
      const decl = this.declaration();
      if (decl) statements.push(decl);
    }
    return statements;
  }

  private declaration(): Stmt | null {
    try {
      if (this.match(Token.FUN)) return this.function("function");
      if (this.match(Token.VAR)) return this.varDeclaration();
      return this.statement();
    } catch (error) {
      this.synchronize();
      return null;
    }
  }

  private function(kind: string): Function {
    const name = this.consume(Token.IDENTIFIER, `Expect ${kind} name.`).value!;
    this.consume(Token.LEFT_PAREN, `Expect '(' after ${kind} name.`);
    
    const parameters: string[] = [];
    if (!this.check(Token.RIGHT_PAREN)) {
      do {
        if (parameters.length >= 255) {
          throw new ParserError("Can't have more than 255 parameters.");
        }
        parameters.push(this.consume(Token.IDENTIFIER, "Expect parameter name.").value!);
      } while (this.match(Token.COMMA));
    }
    
    this.consume(Token.RIGHT_PAREN, "Expect ')' after parameters.");
    this.consume(Token.LEFT_BRACE, `Expect '{' before ${kind} body.`);
    const body = this.block();
    
    return new Function(name, parameters, body);
  }

  private varDeclaration(): Stmt {
    const name = this.consume(Token.IDENTIFIER, "Expect variable name.").value!;

    let initializer: Expr | null = null;
    if (this.match(Token.EQUAL)) {
      initializer = this.expression();
    }

    this.match(Token.SEMICOLON);
    return new Var(name, initializer);
  }

  private statement(): Stmt {
    if (this.match(Token.IF)) return this.ifStatement();
    if (this.match(Token.WHILE)) return this.whileStatement();
    if (this.match(Token.FOR)) return this.forStatement();
    if (this.match(Token.RETURN)) return this.returnStatement();
    if (this.match(Token.OUT)) return this.outputStatement();
    if (this.match(Token.LEFT_BRACE)) return new Block(this.block());

    return this.expressionStatement();
  }

  private ifStatement(): Stmt {
    this.consume(Token.LEFT_PAREN, "Expect '(' after 'if'.");
    const condition = this.expression();
    this.consume(Token.RIGHT_PAREN, "Expect ')' after if condition.");

    const thenBranch = this.statement();
    let elseBranch = null;
    if (this.match(Token.ELSE)) {
      elseBranch = this.statement();
    }

    return new If(condition, thenBranch, elseBranch);
  }

  private whileStatement(): Stmt {
    this.consume(Token.LEFT_PAREN, "Expect '(' after 'while'.");
    const condition = this.expression();
    this.consume(Token.RIGHT_PAREN, "Expect ')' after condition.");
    const body = this.statement();

    return new While(condition, body);
  }

  private forStatement(): Stmt {
    this.consume(Token.LEFT_PAREN, "Expect '(' after 'for'.");

    let initializer: Stmt | null;
    if (this.match(Token.SEMICOLON)) {
      initializer = null;
    } else if (this.match(Token.VAR)) {
      initializer = this.varDeclaration();
    } else {
      initializer = this.expressionStatement();
    }

    let condition: Expr | null = null;
    if (!this.check(Token.SEMICOLON)) {
      condition = this.expression();
    }
    this.consume(Token.SEMICOLON, "Expect ';' after loop condition.");

    let increment: Expr | null = null;
    if (!this.check(Token.RIGHT_PAREN)) {
      increment = this.expression();
    }
    this.consume(Token.RIGHT_PAREN, "Expect ')' after for clauses.");

    let body = this.statement();

    return new For(initializer, condition, increment, body);
  }

  private returnStatement(): Stmt {
    const keyword = this.previous();
    let value = null;
    if (!this.check(Token.SEMICOLON) && !this.check(Token.RIGHT_BRACE)) {
      value = this.expression();
    }

    this.match(Token.SEMICOLON);
    return new Return(value);
  }

  private outputStatement(): Stmt {
    const value = this.expression();
    this.match(Token.SEMICOLON);
    return new Output(value);
  }

  private block(): Stmt[] {
    const statements: Stmt[] = [];

    while (!this.check(Token.RIGHT_BRACE) && !this.isAtEnd()) {
      const decl = this.declaration();
      if (decl) statements.push(decl);
    }

    this.consume(Token.RIGHT_BRACE, "Expect '}' after block.");
    return statements;
  }

  private expressionStatement(): Stmt {
    const expr = this.expression();
    this.match(Token.SEMICOLON);
    return new Expression(expr);
  }

  private expression(): Expr {
    return this.assignment();
  }

  private assignment(): Expr {
    const expr = this.or();

    if (this.match(Token.EQUAL)) {
      const equals = this.previous();
      const value = this.assignment();

      if (expr instanceof Variable) {
        return new Assign(expr.name, value);
      }

      throw new ParserError("Invalid assignment target.");
    }

    return expr;
  }

  private or(): Expr {
    let expr = this.and();

    while (this.match(Token.OR_OR)) {
      const operator = this.previous().token;
      const right = this.and();
      expr = new Logical(expr, operator, right);
    }

    return expr;
  }

  private and(): Expr {
    let expr = this.equality();

    while (this.match(Token.AND_AND)) {
      const operator = this.previous().token;
      const right = this.equality();
      expr = new Logical(expr, operator, right);
    }

    return expr;
  }

  private equality(): Expr {
    let expr = this.comparison();

    while (this.match(Token.BANG_EQUAL, Token.EQUAL_EQUAL)) {
      const operator = this.previous().token;
      const right = this.comparison();
      expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  private comparison(): Expr {
    let expr = this.term();

    while (this.match(Token.GREATER, Token.GREATER_EQUAL, Token.LESS, Token.LESS_EQUAL)) {
      const operator = this.previous().token;
      const right = this.term();
      expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  private term(): Expr {
    let expr = this.factor();

    while (this.match(Token.MINUS, Token.PLUS)) {
      const operator = this.previous().token;
      const right = this.factor();
      expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  private factor(): Expr {
    let expr = this.unary();

    while (this.match(Token.SLASH, Token.STAR)) {
      const operator = this.previous().token;
      const right = this.unary();
      expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  private unary(): Expr {
    if (this.match(Token.BANG, Token.MINUS, Token.TILDE)) {
      const operator = this.previous().token;
      const right = this.unary();
      return new Unary(operator, right);
    }

    return this.call();
  }

  private call(): Expr {
    let expr = this.primary();

    while (true) {
      if (this.match(Token.LEFT_PAREN)) {
        expr = this.finishCall(expr);
      } else {
        break;
      }
    }

    return expr;
  }

  private finishCall(callee: Expr): Expr {
    const args: Expr[] = [];
    if (!this.check(Token.RIGHT_PAREN)) {
      do {
        if (args.length >= 255) {
          throw new ParserError("Can't have more than 255 arguments.");
        }
        args.push(this.expression());
      } while (this.match(Token.COMMA));
    }

    const paren = this.consume(Token.RIGHT_PAREN, "Expect ')' after arguments.");

    return new Call(callee, paren, args);
  }

  private primary(): Expr {
    if (this.match(Token.FALSE)) return new LiteralBool(false);
    if (this.match(Token.TRUE)) return new LiteralBool(true);

    if (this.match(Token.NUMBER)) {
      const value = this.previous().value;
      if (value === undefined) throw new ParserError("Number token has no value");
      return new LiteralNumber(parseFloat(value));
    }

    if (this.match(Token.STRING)) {
      const value = this.previous().value;
      if (value === undefined) throw new ParserError("String token has no value");
      return new LiteralString(value);
    }

    if (this.match(Token.IDENTIFIER)) {
      return new Variable(this.previous());
    }

    if (this.match(Token.LEFT_PAREN)) {
      const expr = this.expression();
      this.consume(Token.RIGHT_PAREN, "Expect ')' after expression.");
      return new Grouping(expr);
    }

    throw new ParserError(`Unexpected token: ${this.peek().token}`);
  }

  private synchronize() {
    this.advance();

    while (!this.isAtEnd()) {
      if (this.previous().token === Token.SEMICOLON) return;

      switch (this.peek().token) {
        case Token.FUN:
        case Token.VAR:
        case Token.FOR:
        case Token.IF:
        case Token.WHILE:
        case Token.RETURN:
          return;
      }

      this.advance();
    }
  }
} 