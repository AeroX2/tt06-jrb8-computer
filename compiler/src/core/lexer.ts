import { Token, TokenObj } from './tokens';

export class LexerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LexerError';
  }
}

const Keywords: Record<string, Token> = {
  "var": Token.VAR,
  "if": Token.IF,
  "else": Token.ELSE,
  "true": Token.TRUE,
  "false": Token.FALSE,
  "for": Token.FOR,
  "while": Token.WHILE,
  "fun": Token.FUN,
  "return": Token.RETURN,
  "out": Token.OUT,
  "in": Token.IN
};

export class Lexer {
  private source: string;
  private tokens: TokenObj[] = [];
  private start = 0;
  private current = 0;
  private line = 1;
  private linePos = 0;

  constructor(source: string) {
    this.source = source;
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private advance(): string {
    this.current++;
    this.linePos++;
    return this.source[this.current - 1];
  }

  private addToken(token: Token, value?: string) {
    this.tokens.push({
      token,
      line: this.line,
      linePos: this.linePos,
      value
    });
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source[this.current] !== expected) return false;

    this.current++;
    this.linePos++;
    return true;
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source[this.current];
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isAlpha(c: string): boolean {
    return (c >= 'a' && c <= 'z') ||
      (c >= 'A' && c <= 'Z') ||
      c === '_';
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c);
  }

  private isHexDigit(c: string): boolean {
    return /[0-9a-fA-F]/.test(c);
  }

  private isOctalDigit(c: string): boolean {
    return /[0-7]/.test(c);
  }

  private isBinaryDigit(c: string): boolean {
    return c === '0' || c === '1';
  }

  private number() {
    const nextChar = this.peek().toLowerCase();
    if (nextChar === 'x' || nextChar === 'o' || nextChar === 'b') {
      // Consume 'x', 'o', or 'b'
      this.advance();

      // Select validator and base based on prefix
      const { fn: validator, base } = {
        'x': {
          fn: this.isHexDigit.bind(this),
          base: 16
        },
        'o': {
          fn: this.isOctalDigit.bind(this), base: 8
        },
        'b': { fn: this.isBinaryDigit.bind(this), base: 2 }
      }[nextChar];
      // Process digits
      while (validator(this.peek())) {
        this.advance();
      }

      const value = this.source.substring(this.start+2, this.current);
      this.addToken(Token.NUMBER, parseInt(value, base).toString());
      return;
    }

    while (this.isDigit(this.peek())) {
      this.advance();
    }
    const value = this.source.substring(this.start, this.current);
    this.addToken(Token.NUMBER, value);
  }

  private string() {
    let value = '';

    while (this.peek() !== '"' && !this.isAtEnd()) {
      if (this.peek() === '\\') {
        this.advance(); // Consume the backslash
        value += this.advance(); // Add the escaped character
      } else {
        value += this.advance();
      }
    }

    if (this.isAtEnd()) {
      throw new LexerError(`Unterminated string at ${this.line}:${this.linePos}`);
    }

    // Consume the closing "
    this.advance();

    this.addToken(Token.STRING, value);
  }

  private identifier() {
    while (this.isAlphaNumeric(this.peek())) {
      this.advance();
    }

    const text = this.source.substring(this.start, this.current);
    let token = Keywords[text];
    if (!token) token = Token.IDENTIFIER;
    this.addToken(token, text);
  }

  public scanTokens(): TokenObj[] {
    while (!this.isAtEnd()) {
      this.start = this.current;
      this.scanToken();
    }

    this.addToken(Token.EOF);
    return this.tokens;
  }

  private scanToken() {
    const c = this.advance();
    switch (c) {
      case '(': this.addToken(Token.LEFT_PAREN); break;
      case ')': this.addToken(Token.RIGHT_PAREN); break;
      case '{': this.addToken(Token.LEFT_BRACE); break;
      case '}': this.addToken(Token.RIGHT_BRACE); break;
      case ',': this.addToken(Token.COMMA); break;
      case '.': this.addToken(Token.DOT); break;
      case '-': this.addToken(Token.MINUS); break;
      case '+': this.addToken(Token.PLUS); break;
      case ';': this.addToken(Token.SEMICOLON); break;
      case '*': this.addToken(Token.STAR); break;
      case '~': this.addToken(Token.TILDE); break;
      case '!': this.addToken(this.match('=') ? Token.BANG_EQUAL : Token.BANG); break;
      case '=': this.addToken(this.match('=') ? Token.EQUAL_EQUAL : Token.EQUAL); break;
      case '<': this.addToken(this.match('=') ? Token.LESS_EQUAL : Token.LESS); break;
      case '>': this.addToken(this.match('=') ? Token.GREATER_EQUAL : Token.GREATER); break;
      case '&': this.addToken(this.match('&') ? Token.AND_AND : Token.AND); break;
      case '|': this.addToken(this.match('|') ? Token.OR_OR : Token.OR); break;
      case '/':
        if (this.match('/')) {
          // A comment goes until the end of the line
          while (this.peek() !== '\n' && !this.isAtEnd()) {
            this.advance();
          }
        } else {
          this.addToken(Token.SLASH);
        }
        break;
      case '"': this.string(); break;

      case ' ':
      case '\r':
      case '\t':
        break;
      case '\n':
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
} 