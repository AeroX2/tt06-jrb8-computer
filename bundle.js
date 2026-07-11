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
    TTBoard: () => TTBoard,
    compile: () => compile,
    compileAssembly: () => compileAssembly,
    compileJrp: () => compileJrp,
    compileSource: () => compileSource,
    detectSourceKind: () => detectSourceKind,
    flashAndRun: () => flashAndRun
  });

  // src/core/lexer.ts
  var LexerError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "LexerError";
    }
  };
  var Keywords = {
    var: "var" /* VAR */,
    if: "if" /* IF */,
    else: "else" /* ELSE */,
    true: "true" /* TRUE */,
    false: "false" /* FALSE */,
    for: "for" /* FOR */,
    while: "while" /* WHILE */,
    fun: "fun" /* FUN */,
    return: "return" /* RETURN */,
    out: "out" /* OUT */,
    in: "in" /* IN */
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
    isDigit(c) {
      return c >= "0" && c <= "9";
    }
    isAlpha(c) {
      return c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c === "_";
    }
    isAlphaNumeric(c) {
      return this.isAlpha(c) || this.isDigit(c);
    }
    isHexDigit(c) {
      return /[0-9a-fA-F]/.test(c);
    }
    isOctalDigit(c) {
      return /[0-7]/.test(c);
    }
    isBinaryDigit(c) {
      return c === "0" || c === "1";
    }
    number() {
      const nextChar = this.peek().toLowerCase();
      if (nextChar === "x" || nextChar === "o" || nextChar === "b") {
        this.advance();
        const { fn: validator, base } = {
          x: {
            fn: this.isHexDigit.bind(this),
            base: 16
          },
          o: {
            fn: this.isOctalDigit.bind(this),
            base: 8
          },
          b: { fn: this.isBinaryDigit.bind(this), base: 2 }
        }[nextChar];
        while (validator(this.peek())) {
          this.advance();
        }
        const value2 = this.source.substring(this.start + 2, this.current);
        this.addToken("number" /* NUMBER */, parseInt(value2, base).toString());
        return;
      }
      while (this.isDigit(this.peek())) {
        this.advance();
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
      const token = Keywords[text] ?? "identifier" /* IDENTIFIER */;
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
        case "~":
          this.addToken("~" /* TILDE */);
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
  var Input = class extends Expr {
    constructor() {
      super();
    }
    accept(visitor) {
      return visitor.visitInput(this);
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
      if (this.match("fun" /* FUN */))
        return this.function("function");
      if (this.match("var" /* VAR */))
        return this.varDeclaration();
      return this.statement();
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
      const body = this.statement();
      return new For(initializer, condition, increment, body);
    }
    returnStatement() {
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
      let expr = this.bitwise();
      while (this.match(">" /* GREATER */, ">=" /* GREATER_EQUAL */, "<" /* LESS */, "<=" /* LESS_EQUAL */)) {
        const operator = this.previous().token;
        const right = this.bitwise();
        expr = new Binary(expr, operator, right);
      }
      return expr;
    }
    bitwise() {
      let expr = this.term();
      while (this.match("&" /* AND */, "|" /* OR */)) {
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
      if (this.match("!" /* BANG */, "-" /* MINUS */, "~" /* TILDE */)) {
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
      if (this.match("in" /* IN */)) {
        return new Input();
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
  };

  // src/utils/cu_flags.ts
  var CU_FLAGS = {
    nop: 0,
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
    halt: 255
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
  var SET_RAMPAGE = /[abcd] rampage/;
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
      nop: (x) => x === "",
      mov: (x) => this.checkMov(x),
      cmp: (x) => x.match(COMPARE) !== null,
      jmp: (x) => x.match(JUMP) !== null,
      jmpr: (x) => x.match(JUMP) !== null,
      opp: () => true,
      load: (x) => this.checkLoad(x),
      save: (x) => this.checkSave(x),
      set: (x) => x.match(SET_RAMPAGE) !== null,
      in: (x) => x.match(REGISTER) !== null,
      out: (x) => x.match(OUT_PATTERN) !== null,
      halt: (x) => x === ""
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
    // Reject opcodes that are broken on the manufactured silicon (docs/hardware-errata.md)
    // so no program can silently assemble to code that misbehaves on the chip.
    // `opp clr` is intentionally NOT rejected: it is a harmless no-op on silicon (E6),
    // which the VM models, so passing it through is safe.
    rejectBrokenSiliconOpcode(line) {
      const jmpFlag = line.match(/^jmp\s+([zocs])\s+/);
      if (jmpFlag) {
        const flag = jmpFlag[1];
        const alt = flag === "z" ? "Use `jmp = <label>` instead." : flag === "c" ? "Use `jmp < <label>` instead." : "There is no working silicon substitute for this flag test.";
        throw new AssemblerError(
          `\`jmp ${flag} {number}\` is broken on silicon (errata E5): a taken branch jumps to {N,N} (= N*0x0101), not the operand address. ${alt}`
        );
      }
      if (/^jmpr\b/.test(line)) {
        throw new AssemblerError(
          "`jmpr` is broken on silicon (errata E4): it fetches two operand bytes, placing the offset in the high byte and desyncing the instruction stream. Use absolute `jmp <label>` instead."
        );
      }
    }
    translateInstructions(line) {
      this.rejectBrokenSiliconOpcode(line);
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
  var HardwareCompiler = class _HardwareCompiler {
    variables = /* @__PURE__ */ new Map();
    nextVarAddress = 0;
    labelCounter = 0;
    scratchDepth = 0;
    lowestScratchAddress = 256;
    // Group related operators into constants for better maintainability
    static COMPARISON_OPERATORS = /* @__PURE__ */ new Set([
      ">" /* GREATER */,
      ">=" /* GREATER_EQUAL */,
      "<" /* LESS */,
      "<=" /* LESS_EQUAL */,
      "==" /* EQUAL_EQUAL */
    ]);
    compileToAssembly(statements) {
      this.variables.clear();
      this.nextVarAddress = 0;
      this.labelCounter = 0;
      this.scratchDepth = 0;
      this.lowestScratchAddress = 256;
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
      } finally {
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
        if (address === void 0) {
          throw new CompileError(`Undefined variable: ${expr.name.value}`);
        }
        return [`load ram[${address}] ${register}`];
      }
      return void 0;
    }
    literalValue(expr) {
      if (expr instanceof Grouping)
        return this.literalValue(expr.expression);
      if (expr instanceof LiteralNumber)
        return expr.val;
      if (expr instanceof LiteralBool)
        return expr.val ? 1 : 0;
      return void 0;
    }
    visit(expr) {
      return expr.accept(this);
    }
    visitBinary(expr) {
      if (_HardwareCompiler.COMPARISON_OPERATORS.has(expr.op)) {
        return this.handleComparison(expr);
      }
      return this.handleBinary(expr);
    }
    handleComparison(expr) {
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
          "cmp b c"
        ];
        return this.finishComparison(result, expr.op);
      });
    }
    finishComparison(result, operator) {
      const skipLabel = this.createLabel();
      const jumpMap = {
        [">" /* GREATER */]: "<=",
        [">=" /* GREATER_EQUAL */]: "<",
        ["<" /* LESS */]: ">=",
        ["<=" /* LESS_EQUAL */]: ">",
        ["==" /* EQUAL_EQUAL */]: "!="
      };
      result.push(`jmp ${jumpMap[operator]} ${skipLabel}`, "opp 1", `:${skipLabel}`);
      return result;
    }
    handleBinary(expr) {
      const opMap = {
        ["+" /* PLUS */]: "a+b",
        ["-" /* MINUS */]: "a-b",
        ["*" /* STAR */]: "a*b",
        ["/" /* SLASH */]: "a/b",
        ["&" /* AND */]: "a&b",
        ["|" /* OR */]: "a|b"
      };
      if (opMap[expr.op] === void 0) {
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
        `opp ${opMap[expr.op]}`
      ]);
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
        case "~" /* TILDE */:
          result.push("opp ~a");
          break;
        case "!" /* BANG */: {
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
      } else if (expr.val === 1) {
        return ["opp 1"];
      } else if (expr.val === -1) {
        return ["opp -1"];
      }
      return [`load rom a ${expr.val}`];
    }
    visitInput(_expr) {
      return [`in a`];
    }
    visitVariable(expr) {
      const address = this.variables.get(expr.name.value ?? "");
      if (address === void 0) {
        throw new CompileError(`Undefined variable: ${expr.name.value}`);
      }
      return [`load ram[${address}] a`];
    }
    visitAssign(expr) {
      const result = expr.value.accept(this);
      const address = this.variables.get(expr.name.value ?? "");
      if (address === void 0) {
        throw new CompileError(`Undefined variable: ${expr.name.value}`);
      }
      result.push(`save a ram[${address}]`);
      return result;
    }
    visitLogical(expr) {
      const endLabel = this.createLabel();
      const result = expr.left.accept(this);
      if (expr.op === "&&" /* AND_AND */) {
        result.push("opp a", `jmp = ${endLabel}`);
      } else if (expr.op === "||" /* OR_OR */) {
        result.push("opp a", `jmp != ${endLabel}`);
      } else {
        throw new CompileError(`Unknown logical operator: ${expr.op}`);
      }
      result.push(...expr.right.accept(this), `:${endLabel}`);
      return result;
    }
    visitCall(expr) {
      const callee = expr.callee;
      const name = callee instanceof Variable ? callee.name.value : void 0;
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
            "mov d a"
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
          "mov d a"
        ]);
      }
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
            return [...offset, ...valueInA ?? [], "save b mar", "save a ram[current]"];
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
            "mov d a"
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
          `load ram[${valueAddress}] a`
        ]);
      }
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
  };

  // src/flasher/ttinit.py
  var ttinit_default = '# SPDX-License-Identifier: Apache-2.0\n# Copyright (C) 2024, Tiny Tapeout LTD\n\nimport os\nimport sys\n\n\ndef report(dict_or_key: dict, val: str = None):\n    if val is not None and not isinstance(dict_or_key, dict):\n        dict_or_key = {dict_or_key: val}\n\n    strs = list(map(lambda x: f"{x[0]}={x[1]}", dict_or_key.items()))\n    print("\\n".join(strs))\n\n\nprint()\nreport("sys.version", sys.version.split(";")[1].strip())\ntry:\n    sdk_version = next(filter(lambda f: f.startswith("release_v"), os.listdir("/")))\nexcept:\n    sdk_version = "unknown"\nreport("tt.sdk_version", sdk_version)\n';

  // src/flasher/ttflash.py
  var ttflash_default = `# SPDX-License-Identifier: Apache-2.0
# Copyright (C) 2024, Tiny Tapeout LTD

import binascii
import gc
import sys
import time

import micropython
import rp2
from machine import Pin
from ttboard.demoboard import DemoBoard
from ttboard.mode import RPMode

@rp2.asm_pio(out_shiftdir=0, autopull=True, pull_thresh=8, autopush=True, push_thresh=8, sideset_init=(rp2.PIO.OUT_LOW,), out_init=rp2.PIO.OUT_LOW)
def spi_cpha0():
    out(pins, 1)             .side(0x0)
    in_(pins, 1)             .side(0x1)

@rp2.asm_pio(out_shiftdir=0, autopull=True, pull_thresh=8, autopush=True, push_thresh=8, sideset_init=(rp2.PIO.OUT_LOW,), out_init=rp2.PIO.OUT_LOW)
def spi_cpha1():
    pull(ifempty)            .side(0x0)
    out(pins, 1)             .side(0x1).delay(1)
    in_(pins, 1)             .side(0x0)
    
class PIOSPI:

    def __init__(self, sm_id, pin_mosi, pin_miso, pin_sck, cpha=False, cpol=False, freq=1000000):
        assert(not(cpol))
        if not cpha:
            self._sm = rp2.StateMachine(sm_id, spi_cpha0, freq=2*freq, sideset_base=Pin(pin_sck), out_base=Pin(pin_mosi), in_base=Pin(pin_miso))
        else:
            self._sm = rp2.StateMachine(sm_id, spi_cpha1, freq=4*freq, sideset_base=Pin(pin_sck), out_base=Pin(pin_mosi), in_base=Pin(pin_miso))
        self._sm.active(1)

        self._sm_tx_dreq = sm_id
        self._sm_rx_dreq = sm_id + 4

        self._dma_write = rp2.DMA()
        self._dma_read = rp2.DMA()

    @micropython.native
    def write1(self, write):
        self._sm.put(write, 24)
        self._sm.get()

    @micropython.native
    def write(self, wdata):
        dummy_bytes = bytearray(1)
        self._dma_read.config(
            read = self._sm,
            write = dummy_bytes,
            count = len(wdata),
            ctrl = self._dma_read.pack_ctrl(
                size      = 0,  # 0 = byte, 1 = half word, 2 = word
                inc_read  = False,
                inc_write = False,
                treq_sel  = self._sm_rx_dreq
            ),
            trigger = True
        )

        self._dma_write.config(
            read = wdata,
            write = self._sm,
            count = len(wdata),
            ctrl = self._dma_write.pack_ctrl(
                size      = 0,  # 0 = byte, 1 = half word, 2 = word
                inc_read  = True,
                inc_write = False,
                treq_sel  = self._sm_tx_dreq
            ),
            trigger = True
        )

        while self._dma_read.active():
            pass
        
    @micropython.native
    def read(self, n, write=0):
        read_buf = bytearray(n)
        self.readinto(read_buf, write)
        return read_buf

    @micropython.native
    def readinto(self, rdata, write=0):
        write_bytes = bytearray(1)
        write_bytes[0] = write
        self._dma_read.config(
            read = self._sm,
            write = rdata,
            count = len(rdata),
            ctrl = self._dma_read.pack_ctrl(
                size      = 0,  # 0 = byte, 1 = half word, 2 = word
                inc_read  = False,
                inc_write = True,
                treq_sel  = self._sm_rx_dreq
            ),
            trigger = True
        )

        self._dma_write.config(
            read = write_bytes,
            write = self._sm,
            count = len(rdata),
            ctrl = self._dma_write.pack_ctrl(
                size      = 0,  # 0 = byte, 1 = half word, 2 = word
                inc_read  = False,
                inc_write = False,
                treq_sel  = self._sm_tx_dreq
            ),
            trigger = True
        )
        
        while self._dma_read.active():
            pass

    @micropython.native
    def write_read_blocking(self, wdata):
        rdata = bytearray(len(wdata))

        self._dma_read.config(
            read = self._sm,
            write = rdata,
            count = len(rdata),
            ctrl = self._dma_read.pack_ctrl(
                size      = 0,  # 0 = byte, 1 = half word, 2 = word
                inc_read  = False,
                inc_write = True,
                treq_sel  = self._sm_rx_dreq
            ),
            trigger = True
        )

        self._dma_write.config(
            read = wdata,
            write = self._sm,
            count = len(wdata),
            ctrl = self._dma_write.pack_ctrl(
                size      = 0,  # 0 = byte, 1 = half word, 2 = word
                inc_read  = True,
                inc_write = False,
                treq_sel  = self._sm_tx_dreq
            ),
            trigger = True
        )

        while self._dma_read.active():
            pass

        return rdata

class SPIFlash:
    PAGE_SIZE = micropython.const(256)
    SECTOR_SIZE = micropython.const(4096)
    BLOCK_SIZE = micropython.const(65536)

    def __init__(self, tt):
        self.tt = tt
        self.spi = PIOSPI(0, tt.pins.uio1.raw_pin, tt.pins.uio2.raw_pin, tt.pins.uio3.raw_pin, freq=10_000_000)
        self.cs = tt.pins.uio0.raw_pin
        self.cs.init(self.cs.OUT, value=1)

    @micropython.native
    def read_status(self):
        self.cs(0)
        try:
            return self.spi.write_read_blocking(b"\\x05\\xFF")[1]  # 'Read Status Register-1' command
        finally:
            self.cs(1)

    @micropython.native
    def wait_not_busy(self, timeout=10000):
        while self.read_status() & 0x1:
            if timeout == 0:
                raise RuntimeError("Timed out while waiting for flash device")
            timeout -= 1
            time.sleep_us(1)

    def identify(self):
        self.wait_not_busy()
        self.cs(0)
        try:
            self.spi.write1(0x9F)
            return self.spi.read(3, 0x00)
        finally:
            self.cs(1)

    @micropython.native
    def write_enable(self):
        self.wait_not_busy()
        self.cs(0)
        try:
            self.spi.write1(0x06)
        finally:
            self.cs(1)

    @micropython.native
    def erase_sector(self, address):
        self.wait_not_busy()
        self.write_enable()
        self.cs(0)
        try:
            self.spi.write(b"\\x20" + address.to_bytes(3, "big"))
        finally:
            self.cs(1)

    @micropython.native
    def program_page(self, address, data):
        self.wait_not_busy()
        self.write_enable()
        self.cs(0)
        try:
            self.spi.write(b"\\x02" + address.to_bytes(3, "big") + data)
        finally:
            self.cs(1)

    @micropython.native
    def program(self, address, data):
        offset = 0
        while offset < len(data):
            page_address = (address + offset) & ~(self.PAGE_SIZE - 1)
            page_offset = (address + offset) % self.PAGE_SIZE
            chunk_size = min(self.PAGE_SIZE - page_offset, len(data) - offset)
            chunk = data[offset : offset + chunk_size]
            self.program_page(page_address + page_offset, chunk)
            offset += chunk_size

    def program_sectors(self, start_address, verify=True):
        addr = start_address
        gc.collect()
        verify_buffer = bytearray(1)
        try:
            micropython.kbd_intr(-1)  # Disable Ctrl-C
            print(f"flash_prog={addr:X}")
            while True:
                line = sys.stdin.buffer.readline()
                if not line:
                    break
                chunk_length = int(line.strip())
                if chunk_length == 0:
                    break

                # Erase the sector while receiving the data
                end_address = addr + chunk_length
                for erase_addr in range(addr, end_address, self.SECTOR_SIZE):
                   self.erase_sector(erase_addr)

                chunk_data = sys.stdin.buffer.read(chunk_length)
                self.program(addr, chunk_data)

                if verify:
                    if chunk_length != len(verify_buffer):
                        verify_buffer = bytearray(chunk_length)
                    self.read_data_into(addr, verify_buffer)
                    if verify_buffer != chunk_data:
                        raise RuntimeError("Verification failed")

                addr += len(chunk_data)
                print(f"flash_prog={addr:X}")
        finally:
            micropython.kbd_intr(3)
        print(f"flash_prog=ok")

    @micropython.native
    def read_data_into(self, address, rdata):
        self.wait_not_busy()
        self.cs(0)
        try:
            self.spi.write(b"\\x03" + address.to_bytes(3, "big"))
            return self.spi.readinto(rdata)
        finally:
            self.cs(1)


tt = DemoBoard.get()
tt.mode = RPMode.ASIC_RP_CONTROL
tt.shuttle.tt_um_chip_rom.enable()
flash = SPIFlash(tt)
print(f"tt.flash_id={binascii.hexlify(flash.identify()).decode()}")
`;

  // src/flasher/tt_board.ts
  var RAW_REPL_ENTER = "";
  var EXECUTE = "";
  var INTERRUPT_AND_EXIT = "";
  var SECTOR_SIZE = 4096;
  var LineBreakTransformer = class {
    buffer = "";
    transform(chunk, controller) {
      this.buffer += chunk;
      const lines = this.buffer.split(/\r\n|\r|\n/);
      this.buffer = lines.pop() ?? "";
      for (const line of lines) {
        controller.enqueue(line);
      }
    }
    flush(controller) {
      if (this.buffer.length > 0) {
        controller.enqueue(this.buffer);
        this.buffer = "";
      }
    }
  };
  function cleanupRawREPL(value) {
    return value.replace(/^(\x04+>OK)+\x04*/, "").replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
  }
  var TTBoard = class _TTBoard {
    constructor(port, options = {}) {
      this.port = port;
      this.options = options;
    }
    reader;
    readableStreamClosed;
    writableStreamClosed;
    writer;
    binaryWriter;
    lineListeners = /* @__PURE__ */ new Set();
    version = null;
    flashId = null;
    booted = false;
    /** Open a Web Serial port and construct a connected board. */
    static async request(options = {}) {
      if (typeof navigator === "undefined" || !navigator.serial) {
        throw new Error(
          "Web Serial is not available. Use Chrome or Edge over https:// or http://localhost."
        );
      }
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      const board = new _TTBoard(port, options);
      await board.start();
      return board;
    }
    // ---- low-level IO -------------------------------------------------------
    async writeText(data) {
      if (this.binaryWriter) {
        this.binaryWriter.releaseLock();
        this.binaryWriter = void 0;
      }
      if (!this.writer) {
        const textEncoderStream = new TextEncoderStream();
        this.writer = textEncoderStream.writable.getWriter();
        this.writableStreamClosed = textEncoderStream.readable.pipeTo(this.port.writable);
      }
      await this.writer.write(data);
    }
    async writeBinary(data) {
      if (this.writer) {
        await this.writer.close();
        await this.writableStreamClosed;
        this.writer = void 0;
      }
      if (!this.binaryWriter) {
        this.binaryWriter = this.port.writable.getWriter();
      }
      await this.binaryWriter.write(data);
    }
    /** Run a statement/block in the raw REPL (terminated by Ctrl-D). */
    async sendCommand(command) {
      this.options.onLog?.(command, true);
      await this.writeText(`${command}${EXECUTE}`);
    }
    processInput(line) {
      if (line.startsWith("BOOT: ")) {
        this.booted = true;
      }
      for (const listener of this.lineListeners) {
        listener(line.trim());
      }
      const eq = line.indexOf("=");
      if (eq > 0) {
        const name = line.slice(0, eq);
        const value = line.slice(eq + 1);
        if (name === "tt.sdk_version") {
          this.version = value.replace(/^release_v/, "");
        } else if (name === "tt.flash_id") {
          this.flashId = value.trim();
        }
      }
      this.options.onLog?.(line, false);
    }
    waitUntil(condition, timeoutMs = 15e3) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.lineListeners.delete(listener);
          reject(new Error("Timed out waiting for board response"));
        }, timeoutMs);
        const listener = (line) => {
          if (condition(line)) {
            clearTimeout(timer);
            this.lineListeners.delete(listener);
            resolve(line);
          }
        };
        this.lineListeners.add(listener);
      });
    }
    // ---- lifecycle ----------------------------------------------------------
    /** Start the read loop, ensure a clean REPL, and load the flasher scripts. */
    async start() {
      void this.readLoop();
      await this.writeText("\n");
      await this.writeText('print(f"tt.sdk_version={tt.version}")\r\n');
      await delay(100);
      if (this.booted) {
        for (let i = 0; i < 60 && this.version == null; i++) {
          await delay(100);
        }
      }
      if (this.version == null) {
        await this.writeText(INTERRUPT_AND_EXIT);
        await this.writeText(EXECUTE);
      }
      await this.writeText(RAW_REPL_ENTER);
      await this.writeText(ttinit_default + EXECUTE);
      await this.loadFlasher();
    }
    /**
     * (Re)run ttflash.py so the RP2040 is in flasher context: ASIC_RP_CONTROL,
     * tt_um_chip_rom enabled, and a fresh SPIFlash driving uio0-3. Needed before
     * programming, including re-flashing after a design has been run.
     */
    async prepareFlash() {
      await this.loadFlasher();
    }
    async loadFlasher() {
      const ready = this.waitUntil((line) => line.startsWith("tt.flash_id="), 2e4);
      await this.writeText(ttflash_default + EXECUTE);
      await ready;
    }
    async readLoop() {
      const { port } = this;
      while (port.readable) {
        const textDecoder = new TextDecoderStream();
        this.readableStreamClosed = port.readable.pipeTo(textDecoder.writable).catch(() => {
        });
        this.reader = textDecoder.readable.pipeThrough(new TransformStream(new LineBreakTransformer())).getReader();
        try {
          for (; ; ) {
            const { value, done } = await this.reader.read();
            if (done) {
              this.reader.releaseLock();
              return;
            }
            if (value) {
              this.processInput(cleanupRawREPL(value));
            }
          }
        } catch {
        } finally {
          this.reader.releaseLock();
        }
      }
    }
    // ---- high-level operations ---------------------------------------------
    /**
     * Program a raw binary image into the QSPI Pmod flash starting at `offset`.
     * The image is streamed to the board in 4 KB sector chunks.
     */
    async programFlash(offset, data, onProgress) {
      const total = data.byteLength;
      const progressListener = (line) => {
        if (line.startsWith("flash_prog=")) {
          const value = line.slice("flash_prog=".length);
          if (value === "ok") {
            onProgress?.({ written: total, total });
          } else {
            const lastAddress = parseInt(value, 16);
            if (!Number.isNaN(lastAddress)) {
              onProgress?.({ written: lastAddress - offset, total });
            }
          }
        }
      };
      this.lineListeners.add(progressListener);
      try {
        const startOffset = `0x${offset.toString(16)}`;
        const firstReady = this.waitUntil((line) => line.startsWith("flash_prog="));
        await this.sendCommand(`flash.program_sectors(${startOffset})`);
        await firstReady;
        for (let i = 0; i < data.length; i += SECTOR_SIZE) {
          const sector = data.slice(i, i + SECTOR_SIZE);
          const ready = this.waitUntil((line) => line.startsWith("flash_prog="), 3e4);
          await this.writeBinary(new TextEncoder().encode(`${sector.length}\r
`));
          await this.writeBinary(sector);
          await ready;
        }
        const done = this.waitUntil((line) => line === "flash_prog=ok", 3e4);
        await this.writeBinary(new TextEncoder().encode("0\r\n"));
        await done;
      } finally {
        this.lineListeners.delete(progressListener);
      }
    }
    /**
     * Enable project `index` on the mux and clock it at `clockHz`.
     *
     * Note: this is a separate board state from flashing. ttflash.py left the
     * board in ASIC_RP_CONTROL with tt_um_chip_rom enabled; enabling `index`
     * re-safes the bidir pins (via the mux reset) so the ASIC can drive the QSPI
     * flash itself.
     */
    /** Run a raw-REPL block and wait for `<token>=ok`, surfacing tracebacks. */
    async runBlock(lines, okToken) {
      const script = [...lines, `print("${okToken}=ok")`].join("\n");
      const done = this.waitUntil(
        (line) => line === `${okToken}=ok` || line.startsWith("Traceback"),
        2e4
      );
      await this.sendCommand(script);
      const result = await done;
      if (result.startsWith("Traceback")) {
        throw new Error(`Board raised an error during "${okToken}" (see log).`);
      }
    }
    /** Enable a project on the mux (does not touch the clock). */
    async enableDesign(index) {
      await this.runBlock(
        [
          "from ttboard.mode import RPMode",
          "tt.mode = RPMode.ASIC_RP_CONTROL",
          `tt.shuttle[${index}].enable()`
        ],
        "des"
      );
    }
    /**
     * Set the project clock frequency (Hz). Safe to call repeatedly, no reflash.
     *
     * clock_project_PWM rejects freqHz > max_rp2040_freq // 2 (default 133 MHz ->
     * 66.5 MHz ceiling), so for higher targets we raise max_rp2040_freq to
     * overclock the RP2040 sysclk, matching what Commander does for 75/100 MHz.
     */
    async setClock(clockHz) {
      const maxRp2040 = Math.max(133e6, clockHz * 2);
      await this.runBlock(
        [`tt.clock_project_PWM(${clockHz}, max_rp2040_freq=${maxRp2040})`],
        "clk"
      );
    }
    /** Enable a project and start its clock in one step. */
    async runDesign(index, clockHz) {
      await this.enableDesign(index);
      await this.setClock(clockHz);
    }
    async close() {
      try {
        await this.reader?.cancel();
      } catch {
      }
      await this.readableStreamClosed?.catch(() => {
      });
      try {
        await this.writeText(INTERRUPT_AND_EXIT);
      } catch {
      }
      try {
        await this.writer?.close();
        await this.writableStreamClosed?.catch(() => {
        });
        if (this.binaryWriter) {
          await this.binaryWriter.close();
        }
      } catch {
      }
      await this.port.close();
    }
  };
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // web.ts
  var CompileError2 = class extends Error {
    constructor(message) {
      super(message);
      this.name = "CompileError";
    }
  };
  function detectSourceKind(source, filename) {
    if (filename) {
      const ext = filename.toLowerCase().split(".").pop();
      if (ext === "jrp")
        return "jrp";
      if (ext === "j" || ext === "asm" || ext === "s")
        return "asm";
    }
    if (/\b(var|while|if|else)\b|[{}]/.test(source) && !/^\s*:/m.test(source)) {
      return "jrp";
    }
    return "asm";
  }
  function compileAssembly(source) {
    const assembler = new Assembler();
    const assembly = source.split("\n");
    const bytecode = assembler.assemble(assembly);
    const machineCode = assembler.hexOutput(bytecode);
    return { assembly, machineCode };
  }
  function compileJrp(source) {
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiler = new HardwareCompiler();
    const assembly = compiler.compileToAssembly(ast);
    const machineCode = compiler.compileToBytecode(assembly);
    return { assembly, machineCode };
  }
  async function compileSource(source, filename) {
    try {
      const kind = detectSourceKind(source, filename);
      return kind === "jrp" ? compileJrp(source) : compileAssembly(source);
    } catch (error) {
      throw new CompileError2(error instanceof Error ? error.message : "Unknown compilation error");
    }
  }
  async function compile(source) {
    try {
      return compileJrp(source);
    } catch (error) {
      throw new CompileError2(error instanceof Error ? error.message : "Unknown compilation error");
    }
  }
  async function flashAndRun(machineCode, options = {}) {
    const { projectIndex = 204, clockHz = 3e7, offset = 0, onProgress, onLog } = options;
    const bytes = machineCode instanceof Uint8Array ? machineCode : new Uint8Array(machineCode);
    const board = await TTBoard.request({ onLog });
    await board.programFlash(offset, bytes, onProgress);
    await board.runDesign(projectIndex, clockHz);
    return board;
  }
  return __toCommonJS(web_exports);
})();
