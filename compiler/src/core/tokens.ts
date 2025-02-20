export enum Token {
  // Single-character tokens
  LEFT_PAREN = "(",
  RIGHT_PAREN = ")",
  LEFT_BRACE = "{",
  RIGHT_BRACE = "}",
  COMMA = ",",
  DOT = ".",
  MINUS = "-",
  PLUS = "+",
  SEMICOLON = ";",
  SLASH = "/",
  STAR = "*",
  TILDE = "~",
  // One or two character tokens
  BANG = "!",
  BANG_EQUAL = "!=",
  EQUAL = "=",
  EQUAL_EQUAL = "==",
  GREATER = ">",
  GREATER_EQUAL = ">=",
  LESS = "<",
  LESS_EQUAL = "<=",
  AND = "&",
  AND_AND = "&&",
  OR = "|",
  OR_OR = "||",
  // Literals
  IDENTIFIER = "identifier",
  STRING = "string",
  NUMBER = "number",
  // Keywords
  VAR = "var",
  IF = "if",
  ELSE = "else",
  TRUE = "true",
  FALSE = "false",
  FOR = "for",
  WHILE = "while",
  FUN = "fun",
  RETURN = "return",
  IN = "in",
  OUT = "out",
  // Specials
  OVERFLOW = "overflow",
  EOF = "eof",
}

export interface TokenObj {
  token: Token;
  line: number;
  linePos: number;
  value?: string;
}

export class ParserException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParserException";
  }
}

export class TokenStream {
  private readonly buffer: TokenObj[];
  private position: number;

  constructor(data: TokenObj[]) {
    this.buffer = data;
    this.position = 0;
  }

  peek(): TokenObj {
    if (this.position < this.buffer.length) {
      return this.buffer[this.position];
    }
    throw new ParserException("Attempted to peek past the end of the stream");
  }

  read(): TokenObj {
    if (this.position < this.buffer.length) {
      return this.buffer[this.position++];
    }
    throw new ParserException("Attempted to read past the end of the stream");
  }
}
