"use strict";
var jrb8Compiler = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // web.ts
  var web_exports = {};
  __export(web_exports, {
    CompileError: () => CompileError2,
    compile: () => compile
  });

  // src/core/lexer.ts
  var LexerError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "LexerError";
    }
  };
  var Keywords = {
    "var": "var" /* VAR */,
    "if": "if" /* IF */,
    "else": "else" /* ELSE */,
    "true": "true" /* TRUE */,
    "false": "false" /* FALSE */,
    "for": "for" /* FOR */,
    "while": "while" /* WHILE */,
    "fun": "fun" /* FUN */,
    "return": "return" /* RETURN */,
    "out": "out" /* OUT */,
    "in": "in" /* IN */
  };
  var Lexer = class {
    source;
    tokens = [];
    start = 0;
    current = 0;
    line = 1;
    linePos = 0;
    constructor(source) {
      this.source = source;
    }
    isAtEnd() {
      return this.current >= this.source.length;
    }
    advance() {
      this.current++;
      this.linePos++;
      return this.source[this.current - 1];
    }
    addToken(token, value) {
      this.tokens.push({
        token,
        line: this.line,
        linePos: this.linePos,
        value
      });
    }
    match(expected) {
      if (this.isAtEnd())
        return false;
      if (this.source[this.current] !== expected)
        return false;
      this.current++;
      this.linePos++;
      return true;
    }
    peek() {
      if (this.isAtEnd())
        return "\0";
      return this.source[this.current];
    }
    peekNext() {
      if (this.current + 1 >= this.source.length)
        return "\0";
      return this.source[this.current + 1];
    }
    isDigit(c) {
      return c >= "0" && c <= "9";
    }
    isAlpha(c) {
      return c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c === "_";
    }
    isAlphaNumeric(c) {
      return this.isAlpha(c) || this.isDigit(c);
    }
    number() {
      while (this.isDigit(this.peek())) {
        this.advance();
      }
      if (this.peek() === "." && this.isDigit(this.peekNext())) {
        this.advance();
        while (this.isDigit(this.peek())) {
          this.advance();
        }
      }
      const value = this.source.substring(this.start, this.current);
      this.addToken("number" /* NUMBER */, value);
    }
    string() {
      let value = "";
      while (this.peek() !== '"' && !this.isAtEnd()) {
        if (this.peek() === "\\") {
          this.advance();
          value += this.advance();
        } else {
          value += this.advance();
        }
      }
      if (this.isAtEnd()) {
        throw new LexerError(`Unterminated string at ${this.line}:${this.linePos}`);
      }
      this.advance();
      this.addToken("string" /* STRING */, value);
    }
    identifier() {
      while (this.isAlphaNumeric(this.peek())) {
        this.advance();
      }
      const text = this.source.substring(this.start, this.current);
      let token = Keywords[text];
      if (!token)
        token = "identifier" /* IDENTIFIER */;
      this.addToken(token, text);
    }
    scanTokens() {
      while (!this.isAtEnd()) {
        this.start = this.current;
        this.scanToken();
      }
      this.addToken("eof" /* EOF */);
      return this.tokens;
    }
    scanToken() {
      const c = this.advance();
      switch (c) {
        case "(":
          this.addToken("(" /* LEFT_PAREN */);
          break;
        case ")":
          this.addToken(")" /* RIGHT_PAREN */);
          break;
        case "{":
          this.addToken("{" /* LEFT_BRACE */);
          break;
        case "}":
          this.addToken("}" /* RIGHT_BRACE */);
          break;
        case ",":
          this.addToken("," /* COMMA */);
          break;
        case ".":
          this.addToken("." /* DOT */);
          break;
        case "-":
          this.addToken("-" /* MINUS */);
          break;
        case "+":
          this.addToken("+" /* PLUS */);
          break;
        case ";":
          this.addToken(";" /* SEMICOLON */);
          break;
        case "*":
          this.addToken("*" /* STAR */);
          break;
        case "!":
          this.addToken(this.match("=") ? "!=" /* BANG_EQUAL */ : "!" /* BANG */);
          break;
        case "=":
          this.addToken(this.match("=") ? "==" /* EQUAL_EQUAL */ : "=" /* EQUAL */);
          break;
        case "<":
          this.addToken(this.match("=") ? "<=" /* LESS_EQUAL */ : "<" /* LESS */);
          break;
        case ">":
          this.addToken(this.match("=") ? ">=" /* GREATER_EQUAL */ : ">" /* GREATER */);
          break;
        case "&":
          this.addToken(this.match("&") ? "&&" /* AND_AND */ : "&" /* AND */);
          break;
        case "|":
          this.addToken(this.match("|") ? "||" /* OR_OR */ : "|" /* OR */);
          break;
        case "/":
          if (this.match("/")) {
            while (this.peek() !== "\n" && !this.isAtEnd()) {
              this.advance();
            }
          } else {
            this.addToken("/" /* SLASH */);
          }
          break;
        case '"':
          this.string();
          break;
        case " ":
        case "\r":
        case "	":
          break;
        case "\n":
          this.line++;
          this.linePos = 0;
          break;
        default:
          if (this.isDigit(c)) {
            this.number();
          } else if (this.isAlpha(c)) {
            this.identifier();
          } else {
            throw new LexerError(`Unexpected character at ${this.line}:${this.linePos}`);
          }
          break;
      }
    }
  };

  // src/ast/expressions.ts
  var Expr = class {
  };
  var Binary = class extends Expr {
    constructor(left, op, right) {
      super();
      this.left = left;
      this.op = op;
      this.right = right;
    }
    accept(visitor) {
      return visitor.visitBinary(this);
    }
  };
  var Grouping = class extends Expr {
    constructor(expression) {
      super();
      this.expression = expression;
    }
    accept(visitor) {
      return visitor.visitGrouping(this);
    }
  };
  var Unary = class extends Expr {
    constructor(op, right) {
      super();
      this.op = op;
      this.right = right;
    }
    accept(visitor) {
      return visitor.visitUnary(this);
    }
  };
  var LiteralBool = class extends Expr {
    constructor(val) {
      super();
      this.val = val;
    }
    accept(visitor) {
      return visitor.visitLiteralBool(this);
    }
  };
  var LiteralString = class extends Expr {
    constructor(val) {
      super();
      this.val = val;
    }
    accept(visitor) {
      return visitor.visitLiteralString(this);
    }
  };
  var LiteralNumber = class extends Expr {
    constructor(val) {
      super();
      this.val = val;
    }
    accept(visitor) {
      return visitor.visitLiteralNumber(this);
    }
  };
  var Variable = class extends Expr {
    constructor(name) {
      super();
      this.name = name;
    }
    accept(visitor) {
      return visitor.visitVariable(this);
    }
  };
  var Assign = class extends Expr {
    constructor(name, value) {
      super();
      this.name = name;
      this.value = value;
    }
    accept(visitor) {
      return visitor.visitAssign(this);
    }
  };
  var Logical = class extends Expr {
    constructor(left, op, right) {
      super();
      this.left = left;
      this.op = op;
      this.right = right;
    }
    accept(visitor) {
      return visitor.visitLogical(this);
    }
  };
  var Call = class extends Expr {
    constructor(callee, paren, args) {
      super();
      this.callee = callee;
      this.paren = paren;
      this.args = args;
    }
    accept(visitor) {
      return visitor.visitCall(this);
    }
  };

  // src/ast/statements.ts
  var Stmt = class {
  };
  var Expression = class extends Stmt {
    constructor(expression) {
      super();
      this.expression = expression;
    }
    accept(visitor) {
      return visitor.visitExpressionStmt(this);
    }
  };
  var If = class extends Stmt {
    constructor(condition, thenBranch, elseBranch) {
      super();
      this.condition = condition;
      this.thenBranch = thenBranch;
      this.elseBranch = elseBranch;
    }
    accept(visitor) {
      return visitor.visitIfStmt(this);
    }
  };
  var While = class extends Stmt {
    constructor(condition, body) {
      super();
      this.condition = condition;
      this.body = body;
    }
    accept(visitor) {
      return visitor.visitWhileStmt(this);
    }
  };
  var For = class extends Stmt {
    constructor(initializer, condition, increment, body) {
      super();
      this.initializer = initializer;
      this.condition = condition;
      this.increment = increment;
      this.body = body;
    }
    accept(visitor) {
      return visitor.visitForStmt(this);
    }
  };
  var Block = class extends Stmt {
    constructor(statements) {
      super();
      this.statements = statements;
    }
    accept(visitor) {
      return visitor.visitBlockStmt(this);
    }
  };
  var Var = class extends Stmt {
    constructor(name, initializer) {
      super();
      this.name = name;
      this.initializer = initializer;
    }
    accept(visitor) {
      return visitor.visitVarStmt(this);
    }
  };
  var Function = class extends Stmt {
    constructor(name, params, body) {
      super();
      this.name = name;
      this.params = params;
      this.body = body;
    }
    accept(visitor) {
      return visitor.visitFunctionStmt(this);
    }
  };
  var Return = class extends Stmt {
    constructor(value) {
      super();
      this.value = value;
    }
    accept(visitor) {
      return visitor.visitReturnStmt(this);
    }
  };
  var Output = class extends Stmt {
    constructor(expression) {
      super();
      this.expression = expression;
    }
    accept(visitor) {
      return visitor.visitOutputStmt(this);
    }
  };

  // src/core/parser.ts
  var ParserError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "ParserError";
    }
  };
  var Parser = class {
    tokens;
    current = 0;
    constructor(tokens) {
      this.tokens = tokens;
    }
    peek() {
      return this.tokens[this.current];
    }
    previous() {
      return this.tokens[this.current - 1];
    }
    isAtEnd() {
      return this.peek().token === "eof" /* EOF */;
    }
    advance() {
      if (!this.isAtEnd())
        this.current++;
      return this.previous();
    }
    check(type) {
      if (this.isAtEnd())
        return false;
      return this.peek().token === type;
    }
    match(...types) {
      for (const type of types) {
        if (this.check(type)) {
          this.advance();
          return true;
        }
      }
      return false;
    }
    consume(type, message) {
      if (this.check(type))
        return this.advance();
      throw new ParserError(message);
    }
    parse() {
      const statements = [];
      while (!this.isAtEnd()) {
        const decl = this.declaration();
        if (decl)
          statements.push(decl);
      }
      return statements;
    }
    declaration() {
      try {
        if (this.match("fun" /* FUN */))
          return this.function("function");
        if (this.match("var" /* VAR */))
          return this.varDeclaration();
        return this.statement();
      } catch (error) {
        this.synchronize();
        return null;
      }
    }
    function(kind) {
      const name = this.consume("identifier" /* IDENTIFIER */, `Expect ${kind} name.`).value;
      this.consume("(" /* LEFT_PAREN */, `Expect '(' after ${kind} name.`);
      const parameters = [];
      if (!this.check(")" /* RIGHT_PAREN */)) {
        do {
          if (parameters.length >= 255) {
            throw new ParserError("Can't have more than 255 parameters.");
          }
          parameters.push(this.consume("identifier" /* IDENTIFIER */, "Expect parameter name.").value);
        } while (this.match("," /* COMMA */));
      }
      this.consume(")" /* RIGHT_PAREN */, "Expect ')' after parameters.");
      this.consume("{" /* LEFT_BRACE */, `Expect '{' before ${kind} body.`);
      const body = this.block();
      return new Function(name, parameters, body);
    }
    varDeclaration() {
      const name = this.consume("identifier" /* IDENTIFIER */, "Expect variable name.").value;
      let initializer = null;
      if (this.match("=" /* EQUAL */)) {
        initializer = this.expression();
      }
      this.match(";" /* SEMICOLON */);
      return new Var(name, initializer);
    }
    statement() {
      if (this.match("if" /* IF */))
        return this.ifStatement();
      if (this.match("while" /* WHILE */))
        return this.whileStatement();
      if (this.match("for" /* FOR */))
        return this.forStatement();
      if (this.match("return" /* RETURN */))
        return this.returnStatement();
      if (this.match("out" /* OUT */))
        return this.outputStatement();
      if (this.match("{" /* LEFT_BRACE */))
        return new Block(this.block());
      return this.expressionStatement();
    }
    ifStatement() {
      this.consume("(" /* LEFT_PAREN */, "Expect '(' after 'if'.");
      const condition = this.expression();
      this.consume(")" /* RIGHT_PAREN */, "Expect ')' after if condition.");
      const thenBranch = this.statement();
      let elseBranch = null;
      if (this.match("else" /* ELSE */)) {
        elseBranch = this.statement();
      }
      return new If(condition, thenBranch, elseBranch);
    }
    whileStatement() {
      this.consume("(" /* LEFT_PAREN */, "Expect '(' after 'while'.");
      const condition = this.expression();
      this.consume(")" /* RIGHT_PAREN */, "Expect ')' after condition.");
      const body = this.statement();
      return new While(condition, body);
    }
    forStatement() {
      this.consume("(" /* LEFT_PAREN */, "Expect '(' after 'for'.");
      let initializer;
      if (this.match(";" /* SEMICOLON */)) {
        initializer = null;
      } else if (this.match("var" /* VAR */)) {
        initializer = this.varDeclaration();
      } else {
        initializer = this.expressionStatement();
      }
      let condition = null;
      if (!this.check(";" /* SEMICOLON */)) {
        condition = this.expression();
      }
      this.consume(";" /* SEMICOLON */, "Expect ';' after loop condition.");
      let increment = null;
      if (!this.check(")" /* RIGHT_PAREN */)) {
        increment = this.expression();
      }
      this.consume(")" /* RIGHT_PAREN */, "Expect ')' after for clauses.");
      let body = this.statement();
      return new For(initializer, condition, increment, body);
    }
    returnStatement() {
      const keyword = this.previous();
      let value = null;
      if (!this.check(";" /* SEMICOLON */) && !this.check("}" /* RIGHT_BRACE */)) {
        value = this.expression();
      }
      this.match(";" /* SEMICOLON */);
      return new Return(value);
    }
    outputStatement() {
      const value = this.expression();
      this.match(";" /* SEMICOLON */);
      return new Output(value);
    }
    block() {
      const statements = [];
      while (!this.check("}" /* RIGHT_BRACE */) && !this.isAtEnd()) {
        const decl = this.declaration();
        if (decl)
          statements.push(decl);
      }
      this.consume("}" /* RIGHT_BRACE */, "Expect '}' after block.");
      return statements;
    }
    expressionStatement() {
      const expr = this.expression();
      this.match(";" /* SEMICOLON */);
      return new Expression(expr);
    }
    expression() {
      return this.assignment();
    }
    assignment() {
      const expr = this.or();
      if (this.match("=" /* EQUAL */)) {
        const equals = this.previous();
        const value = this.assignment();
        if (expr instanceof Variable) {
          return new Assign(expr.name, value);
        }
        throw new ParserError("Invalid assignment target.");
      }
      return expr;
    }
    or() {
      let expr = this.and();
      while (this.match("||" /* OR_OR */)) {
        const operator = this.previous().token;
        const right = this.and();
        expr = new Logical(expr, operator, right);
      }
      return expr;
    }
    and() {
      let expr = this.equality();
      while (this.match("&&" /* AND_AND */)) {
        const operator = this.previous().token;
        const right = this.equality();
        expr = new Logical(expr, operator, right);
      }
      return expr;
    }
    equality() {
      let expr = this.comparison();
      while (this.match("!=" /* BANG_EQUAL */, "==" /* EQUAL_EQUAL */)) {
        const operator = this.previous().token;
        const right = this.comparison();
        expr = new Binary(expr, operator, right);
      }
      return expr;
    }
    comparison() {
      let expr = this.term();
      while (this.match(">" /* GREATER */, ">=" /* GREATER_EQUAL */, "<" /* LESS */, "<=" /* LESS_EQUAL */)) {
        const operator = this.previous().token;
        const right = this.term();
        expr = new Binary(expr, operator, right);
      }
      return expr;
    }
    term() {
      let expr = this.factor();
      while (this.match("-" /* MINUS */, "+" /* PLUS */)) {
        const operator = this.previous().token;
        const right = this.factor();
        expr = new Binary(expr, operator, right);
      }
      return expr;
    }
    factor() {
      let expr = this.unary();
      while (this.match("/" /* SLASH */, "*" /* STAR */)) {
        const operator = this.previous().token;
        const right = this.unary();
        expr = new Binary(expr, operator, right);
      }
      return expr;
    }
    unary() {
      if (this.match("!" /* BANG */, "-" /* MINUS */)) {
        const operator = this.previous().token;
        const right = this.unary();
        return new Unary(operator, right);
      }
      return this.call();
    }
    call() {
      let expr = this.primary();
      while (true) {
        if (this.match("(" /* LEFT_PAREN */)) {
          expr = this.finishCall(expr);
        } else {
          break;
        }
      }
      return expr;
    }
    finishCall(callee) {
      const args = [];
      if (!this.check(")" /* RIGHT_PAREN */)) {
        do {
          if (args.length >= 255) {
            throw new ParserError("Can't have more than 255 arguments.");
          }
          args.push(this.expression());
        } while (this.match("," /* COMMA */));
      }
      const paren = this.consume(")" /* RIGHT_PAREN */, "Expect ')' after arguments.");
      return new Call(callee, paren, args);
    }
    primary() {
      if (this.match("false" /* FALSE */))
        return new LiteralBool(false);
      if (this.match("true" /* TRUE */))
        return new LiteralBool(true);
      if (this.match("number" /* NUMBER */)) {
        const value = this.previous().value;
        if (value === void 0)
          throw new ParserError("Number token has no value");
        return new LiteralNumber(parseFloat(value));
      }
      if (this.match("string" /* STRING */)) {
        const value = this.previous().value;
        if (value === void 0)
          throw new ParserError("String token has no value");
        return new LiteralString(value);
      }
      if (this.match("identifier" /* IDENTIFIER */)) {
        return new Variable(this.previous());
      }
      if (this.match("(" /* LEFT_PAREN */)) {
        const expr = this.expression();
        this.consume(")" /* RIGHT_PAREN */, "Expect ')' after expression.");
        return new Grouping(expr);
      }
      throw new ParserError(`Unexpected token: ${this.peek().token}`);
    }
    synchronize() {
      this.advance();
      while (!this.isAtEnd()) {
        if (this.previous().token === ";" /* SEMICOLON */)
          return;
        switch (this.peek().token) {
          case "fun" /* FUN */:
          case "var" /* VAR */:
          case "for" /* FOR */:
          case "if" /* IF */:
          case "while" /* WHILE */:
          case "return" /* RETURN */:
            return;
        }
        this.advance();
      }
    }
  };

  // src/utils/cu_flags.ts
  var CU_FLAGS = {
    "nop": 0,
    "mov a b": 1,
    "mov a c": 2,
    "mov a d": 3,
    "mov b a": 4,
    "mov b c": 5,
    "mov b d": 6,
    "mov c a": 7,
    "mov c b": 8,
    "mov c d": 9,
    "mov d a": 10,
    "mov d b": 11,
    "mov d c": 12,
    "cmp a 0": 16,
    "cmp b 0": 17,
    "cmp c 0": 18,
    "cmp d 0": 19,
    "cmp a 1": 20,
    "cmp b 1": 21,
    "cmp c 1": 22,
    "cmp d 1": 23,
    "cmp a -1": 24,
    "cmp b -1": 25,
    "cmp c -1": 26,
    "cmp d -1": 27,
    "cmp a 255": 28,
    "cmp b 255": 29,
    "cmp c 255": 30,
    "cmp d 255": 31,
    "cmp a a": 32,
    "cmp a b": 33,
    "cmp a c": 34,
    "cmp a d": 35,
    "cmp b a": 36,
    "cmp b b": 37,
    "cmp b c": 38,
    "cmp b d": 39,
    "cmp c a": 40,
    "cmp c b": 41,
    "cmp c c": 42,
    "cmp c d": 43,
    "cmp d a": 44,
    "cmp d b": 45,
    "cmp d c": 46,
    "cmp d d": 47,
    "jmp {label}": 48,
    "jmp = {label}": 49,
    "jmp != {label}": 50,
    "jmp < {label}": 51,
    "jmp <= {label}": 52,
    "jmp > {label}": 53,
    "jmp >= {label}": 54,
    "jmp .< {label}": 55,
    "jmp .<= {label}": 56,
    "jmp .> {label}": 57,
    "jmp .>= {label}": 58,
    "jmp z {number}": 59,
    "jmp o {number}": 60,
    "jmp c {number}": 61,
    "jmp s {number}": 62,
    "jmpr {number}": 64,
    "jmpr = {number}": 65,
    "jmpr != {number}": 66,
    "jmpr < {number}": 67,
    "jmpr <= {number}": 68,
    "jmpr > {number}": 69,
    "jmpr >= {number}": 70,
    "jmpr .< {number}": 71,
    "jmpr .<= {number}": 72,
    "jmpr .> {number}": 73,
    "jmpr .>= {number}": 74,
    "jmpr z {number}": 75,
    "jmpr o {number}": 76,
    "jmpr c {number}": 77,
    "jmpr s {number}": 78,
    "opp clr": 80,
    "opp carry off": 81,
    "opp carry on": 82,
    "opp sign off": 83,
    "opp sign on": 84,
    "opp 0": 85,
    "opp 1": 86,
    "opp -1": 87,
    "opp a": 88,
    "opp b": 89,
    "opp c": 90,
    "opp d": 91,
    "opp ~a": 92,
    "opp ~b": 93,
    "opp ~c": 94,
    "opp ~d": 95,
    "opp -a": 96,
    "opp -b": 97,
    "opp -c": 98,
    "opp -d": 99,
    "opp a+1": 100,
    "opp b+1": 101,
    "opp c+1": 102,
    "opp d+1": 103,
    "opp a-1": 104,
    "opp b-1": 105,
    "opp c-1": 106,
    "opp d-1": 107,
    "opp a+b": 108,
    "opp a+c": 109,
    "opp a+d": 110,
    "opp b+a": 111,
    "opp b+c": 112,
    "opp b+d": 113,
    "opp c+a": 114,
    "opp c+b": 115,
    "opp c+d": 116,
    "opp d+a": 117,
    "opp d+b": 118,
    "opp d+c": 119,
    "opp a-b": 120,
    "opp a-c": 121,
    "opp a-d": 122,
    "opp b-a": 123,
    "opp b-c": 124,
    "opp b-d": 125,
    "opp c-a": 126,
    "opp c-b": 127,
    "opp c-d": 128,
    "opp d-a": 129,
    "opp d-b": 130,
    "opp d-c": 131,
    "opp a*a": 132,
    "opp a*b": 133,
    "opp a*c": 134,
    "opp a*d": 135,
    "opp b*a": 136,
    "opp b*b": 137,
    "opp b*c": 138,
    "opp b*d": 139,
    "opp c*a": 140,
    "opp c*b": 141,
    "opp c*c": 142,
    "opp c*d": 143,
    "opp d*a": 144,
    "opp d*b": 145,
    "opp d*c": 146,
    "opp d*d": 147,
    "opp a.*a": 148,
    "opp a.*b": 149,
    "opp a.*c": 150,
    "opp a.*d": 151,
    "opp b.*a": 152,
    "opp b.*b": 153,
    "opp b.*c": 154,
    "opp b.*d": 155,
    "opp c.*a": 156,
    "opp c.*b": 157,
    "opp c.*c": 158,
    "opp c.*d": 159,
    "opp d.*a": 160,
    "opp d.*b": 161,
    "opp d.*c": 162,
    "opp d.*d": 163,
    "opp a/b": 164,
    "opp a/c": 165,
    "opp a/d": 166,
    "opp b/a": 167,
    "opp b/c": 168,
    "opp b/d": 169,
    "opp c/a": 170,
    "opp c/b": 171,
    "opp c/d": 172,
    "opp d/a": 173,
    "opp d/b": 174,
    "opp d/c": 175,
    "opp a&b": 176,
    "opp a&c": 177,
    "opp a&d": 178,
    "opp b&c": 179,
    "opp b&d": 180,
    "opp c&d": 181,
    "opp a|b": 182,
    "opp a|c": 183,
    "opp a|d": 184,
    "opp b|c": 185,
    "opp b|d": 186,
    "opp c|d": 187,
    "load ram[a] a": 192,
    "load ram[a] b": 193,
    "load ram[a] c": 194,
    "load ram[a] d": 195,
    "load ram[b] a": 196,
    "load ram[b] b": 197,
    "load ram[b] c": 198,
    "load ram[b] d": 199,
    "load ram[c] a": 200,
    "load ram[c] b": 201,
    "load ram[c] c": 202,
    "load ram[c] d": 203,
    "load ram[d] a": 204,
    "load ram[d] b": 205,
    "load ram[d] c": 206,
    "load ram[d] d": 207,
    "load rom a {number}": 208,
    "load rom b {number}": 209,
    "load rom c {number}": 210,
    "load rom d {number}": 211,
    "load ram[{number}] a": 212,
    "load ram[{number}] b": 213,
    "load ram[{number}] c": 214,
    "load ram[{number}] d": 215,
    "set a rampage": 216,
    "set b rampage": 217,
    "set c rampage": 218,
    "set d rampage": 219,
    "save a mar": 224,
    "save b mar": 225,
    "save c mar": 226,
    "save d mar": 227,
    "save a ram[current]": 228,
    "save b ram[current]": 229,
    "save c ram[current]": 230,
    "save d ram[current]": 231,
    "save a ram[a]": 232,
    "save b ram[c]": 233,
    "save c ram[d]": 234,
    "save d ram[d]": 235,
    "save a ram[{number}]": 236,
    "save b ram[{number}]": 237,
    "save c ram[{number}]": 238,
    "save d ram[{number}]": 239,
    "in a": 240,
    "in b": 241,
    "in c": 242,
    "in d": 243,
    "out a": 244,
    "out b": 245,
    "out c": 246,
    "out d": 247,
    "out {number}": 248,
    "out ram[{number}]": 249,
    "out ram[a]": 250,
    "out ram[b]": 251,
    "out ram[c]": 252,
    "out ram[d]": 253,
    "halt": 255
  };

  // src/core/assembler.ts
  var AssemblerError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "AssemblerError";
    }
  };
  var REGISTER = /[abcd]/;
  var REGISTER_PAIR = /([abcd]) ([abcd])/;
  var NUMBER = /((0x[0-9a-fA-F]+)|(0b[01]+)|(0o[0-9]+)|([0-9]+))/;
  var RAM_REGISTER = /ram\[[abcd]\] [abcd]/;
  var RAM_NUMBER = /ram\[[0-9]+\] [abcd]/;
  var ROM_LOAD = /rom [abcd] [0-9]+/;
  var RAM_SAVE = /[abcd] ram/;
  var RAM_REGISTER_SAVE = /[abcd] ram\[[abcd]\]/;
  var RAM_NUMBER_SAVE = /[abcd] ram\[[0-9]+\]/;
  var MAR_SAVE = /[abcd] mar/;
  var COMPARE = /([abcd]) ([abcd]|0|1|-1|255)/;
  var JUMP = /(\.?(<=|<|=|>|>=) [abcd])|(.+)/;
  var OUT_PATTERN = /[abcd]|[0-9]+|ram\[[0-9]+\]|ram\[[abcd]\]/;
  var Assembler = class {
    final = [];
    labels = /* @__PURE__ */ new Map();
    offset = { value: 0 };
    // Helper functions for instruction checking
    checkMov(args) {
      const r = args.match(REGISTER_PAIR);
      return r !== null && r[1] !== r[2];
    }
    checkLoad(args) {
      if (args.match(RAM_REGISTER))
        return true;
      if (args.match(RAM_NUMBER))
        return true;
      return args.match(ROM_LOAD) !== null;
    }
    checkSave(args) {
      if (args.match(RAM_SAVE))
        return true;
      if (args.match(RAM_REGISTER_SAVE))
        return true;
      if (args.match(RAM_NUMBER_SAVE))
        return true;
      return args.match(MAR_SAVE) !== null;
    }
    // Define operations map with proper type
    operations = {
      "nop": (x) => x === "",
      "mov": (x) => this.checkMov(x),
      "cmp": (x) => x.match(COMPARE) !== null,
      "jmp": (x) => x.match(JUMP) !== null,
      "jmpr": (x) => x.match(JUMP) !== null,
      "opp": (x) => true,
      "load": (x) => this.checkLoad(x),
      "save": (x) => this.checkSave(x),
      "in": (x) => x.match(REGISTER) !== null,
      "out": (x) => x.match(OUT_PATTERN) !== null,
      "halt": (x) => x === ""
    };
    // Get translation stage two instructions (those with {label} or {number})
    translationKeys = Object.keys(CU_FLAGS);
    translationStageTwo = this.translationKeys.filter(
      (key) => key.includes("{label}") || key.includes("{number}")
    );
    matchLabelInstruction(line, instruction) {
      const escapedInstruction = this.escapeRegExp(instruction);
      const matchWholeIns = `^${escapedInstruction.replace(/\\{label\\}/, "([^ ]+)")}$`;
      const match = line.match(new RegExp(matchWholeIns));
      if (match) {
        return [
          { kind: 0 /* HEX */, hex: CU_FLAGS[instruction] },
          { kind: 1 /* LABEL */, label: match[1] }
        ];
      }
      return null;
    }
    matchNumberInstruction(line, instruction) {
      const escapedInstruction = this.escapeRegExp(instruction);
      const matchWholeIns = `^${escapedInstruction.replace(/\\{number\\}/, NUMBER.source)}$`;
      const match = line.match(new RegExp(matchWholeIns));
      if (match) {
        let num;
        if (match[2]) {
          num = parseInt(match[2], 16);
        } else if (match[3]) {
          num = parseInt(match[3].substring(2), 2);
        } else if (match[4]) {
          num = parseInt(match[4].substring(2), 8);
        } else {
          num = parseInt(match[5]);
        }
        if (!this.validateHex(num)) {
          throw new AssemblerError("Number larger than can fit in register");
        }
        return [
          { kind: 0 /* HEX */, hex: CU_FLAGS[instruction] },
          { kind: 0 /* HEX */, hex: num }
        ];
      }
      return null;
    }
    oppToHex(line, offset) {
      if (line in CU_FLAGS) {
        offset.value++;
        return [{ kind: 0 /* HEX */, hex: CU_FLAGS[line] }];
      }
      for (const instruction of this.translationStageTwo) {
        let result;
        if (instruction.includes("{label}")) {
          result = this.matchLabelInstruction(line, instruction);
        } else {
          result = this.matchNumberInstruction(line, instruction);
        }
        if (result) {
          offset.value += instruction.includes("{label}") ? 3 : 2;
          return result;
        }
      }
      return [];
    }
    handleLabels(line, labels, offset) {
      const labelMatch = line.match(/:(.+)/);
      if (labelMatch) {
        const label = labelMatch[1].trim();
        if (labels.has(label)) {
          throw new AssemblerError(`Duplicate label detected: ${label}`);
        }
        labels.set(label, offset);
        return true;
      }
      return false;
    }
    translateInstructions(line) {
      const variables = line.split(" ");
      const opp = variables[0];
      const oppArgs = variables.slice(1).join(" ");
      if (opp in this.operations) {
        if (!this.operations[opp](oppArgs)) {
          throw new AssemblerError(`Invalid operation: ${line}`);
        }
        const hexOp = this.oppToHex(line, this.offset);
        if (hexOp.length === 0) {
          throw new AssemblerError(`Could not translate instruction: ${line}`);
        }
        this.final.push(...hexOp);
      } else {
        throw new AssemblerError(`Unrecognized instruction: ${line}`);
      }
    }
    /**
     * Assembles a list of assembly instructions into machine code
     * @param lines Array of assembly instruction strings
     * @returns Array of hex values and labels
     * @throws AssemblerError if assembly fails
     */
    assemble(lines) {
      if (!Array.isArray(lines)) {
        throw new AssemblerError("Input must be an array of strings");
      }
      this.final = [];
      this.labels.clear();
      this.offset.value = 0;
      for (let line of lines) {
        line = line.replace(/\/\/.*/, "").trim();
        if (line.length === 0)
          continue;
        if (this.handleLabels(line, this.labels, this.offset.value)) {
          continue;
        }
        this.translateInstructions(line);
      }
      return this.final;
    }
    hexOutput(final) {
      const fileOutput = [];
      for (const ins of final) {
        if (ins.kind === 1 /* LABEL */) {
          const labelHex = this.labels.get(ins.label);
          if (labelHex === void 0) {
            throw new AssemblerError(`Undefined label: ${ins.label}`);
          }
          fileOutput.push(labelHex >> 8);
          fileOutput.push(labelHex & 255);
        } else {
          fileOutput.push(ins.hex);
        }
      }
      return fileOutput;
    }
    validateHex(hex) {
      return Number.isInteger(hex) && hex >= 0 && hex <= 255;
    }
    escapeRegExp(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  };

  // src/vm/hardware_compiler.ts
  var CompileError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "CompileError";
    }
  };
  var HardwareCompiler = class {
    variables = /* @__PURE__ */ new Map();
    nextVarAddress = 0;
    labelCounter = 0;
    compile(statements) {
      this.variables.clear();
      this.nextVarAddress = 0;
      this.labelCounter = 0;
      const assemblyLines = [];
      for (const stmt of statements) {
        assemblyLines.push(...stmt.accept(this));
      }
      console.log("Generated assembly:", assemblyLines.join("\n"));
      const assembler = new Assembler();
      const bytecode = assembler.assemble(assemblyLines);
      const resolvedBytecode = assembler.hexOutput(bytecode);
      if (resolvedBytecode.length === 0) {
        throw new CompileError("Failed to resolve all labels in the bytecode");
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
      if (expr.op === "-" /* MINUS */) {
        result.push(...expr.right.accept(this));
        result.push("mov a b");
        result.push(...expr.left.accept(this));
        result.push("opp a-b");
      } else {
        result.push(...expr.left.accept(this));
        result.push("mov a b");
        result.push(...expr.right.accept(this));
        switch (expr.op) {
          case "+" /* PLUS */:
            result.push("opp a+b");
            break;
          case "*" /* STAR */:
            result.push("opp a*b");
            break;
          case "/" /* SLASH */:
            result.push("opp a/b");
            break;
          case ">" /* GREATER */:
          case ">=" /* GREATER_EQUAL */:
          case "<" /* LESS */:
          case "<=" /* LESS_EQUAL */:
          case "==" /* EQUAL_EQUAL */:
            result.push("cmp a b");
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
        case "-" /* MINUS */:
          result.push("opp -a");
          break;
        case "!" /* BANG */:
          result.push("cmp a 0");
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
      const address = this.variables.get(expr.name.value || "");
      if (address === void 0) {
        throw new CompileError(`Undefined variable: ${expr.name.value}`);
      }
      return [`load ram[${address}] a`];
    }
    visitAssign(expr) {
      const result = expr.value.accept(this);
      const address = this.variables.get(expr.name.value || "");
      if (address === void 0) {
        throw new CompileError(`Undefined variable: ${expr.name.value}`);
      }
      result.push(`save a ram[${address}]`);
      return result;
    }
    visitLogical(expr) {
      if (expr.op === "&&" /* AND_AND */) {
        const endLabel = this.createLabel();
        const result = expr.left.accept(this);
        result.push(
          "cmp a 0",
          `jmp = ${endLabel}`
        );
        result.push(...expr.right.accept(this));
        result.push(`:${endLabel}`);
        return result;
      } else if (expr.op === "||" /* OR_OR */) {
        const endLabel = this.createLabel();
        const result = expr.left.accept(this);
        result.push(
          "cmp a 0",
          `jmp != ${endLabel}`
        );
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
      result.push(
        "cmp a 0",
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
    visitWhileStmt(stmt) {
      const startLabel = this.createLabel();
      const endLabel = this.createLabel();
      const result = [];
      result.push(`:${startLabel}`);
      result.push(...stmt.condition.accept(this));
      result.push(
        "cmp a 0",
        `jmp = ${endLabel}`
      );
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
        result.push(
          "cmp a 0",
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
        result.push(
          ...stmt.initializer.accept(this),
          `save a ram[${address}]`
        );
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
      result.push("out a");
      return result;
    }
  };

  // web.ts
  var CompileError2 = class extends Error {
    constructor(message) {
      super(message);
      this.name = "CompileError";
    }
  };
  async function compile(source) {
    try {
      const lexer = new Lexer(source);
      const tokens = lexer.scanTokens();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      const compiler = new HardwareCompiler();
      const machineCode = compiler.compile(ast);
      const hexCode = machineCode.map((byte) => byte.toString(16).padStart(2, "0"));
      return {
        machineCode,
        hexCode
      };
    } catch (error) {
      throw new CompileError2(error instanceof Error ? error.message : "Unknown compilation error");
    }
  }
  return __toCommonJS(web_exports);
})();
