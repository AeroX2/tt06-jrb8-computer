import streams
import options

type Token* = enum
  # Single-character tokens.
  LEFT_PAREN
  RIGHT_PAREN
  LEFT_BRACE
  RIGHT_BRACE
  COMMA
  DOT
  MINUS
  PLUS
  SEMICOLON
  SLASH
  STAR
  # One or two character tokens.
  BANG
  BANG_EQUAL
  EQUAL
  EQUAL_EQUAL
  GREATER
  GREATER_EQUAL
  LESS
  LESS_EQUAL
  AND
  AND_AND
  OR
  OR_OR
  # Literals.
  IDENTIFIER
  STRING
  NUMBER
  # Keywords.
  VAR
  IF
  ELSE
  TRUE
  FALSE
  FOR
  WHILE
  FUN
  RETURN
  IN
  OUT
  # Specials
  OVERFLOW
  EOF

type TokenObj* = tuple
  token: Token
  line: int
  linePos: int
  value: Option[string]

type Tokens* = seq[TokenObj]

type ParserException* = object of ValueError

type TokenStream* = object of Stream
    buffer: Tokens
    position: int

proc newTokenStream*(data: Tokens): TokenStream = 
    return TokenStream(buffer: data, position: 0)

proc peek*(self: TokenStream): TokenObj =
  if self.position < self.buffer.len:
    return self.buffer[self.position]
  else:
    raise ParserException.newException("Attempted to peek past the end of the stream")

proc read*(self: var TokenStream): TokenObj =
  if self.position < self.buffer.len:
    result = self.buffer[self.position]
    self.position += 1
  else:
    raise ParserException.newException("Attempted to read past the end of the stream")