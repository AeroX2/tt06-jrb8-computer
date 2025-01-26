import tables
import streams
import options
import strutils
import strformat

type LexerException* = object of ValueError

type Token = enum
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
  STAR # One or two character tokens.
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
  OR_OR # Literals.
  IDENTIFIER
  STRING
  NUMBER # Keywords.
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
  EOF

let Keywords = {
  "var": Token.VAR,
  "if": Token.IF,
  "else": Token.ELSE,
  "true": Token.TRUE,
  "false": Token.FALSE,
  #
  "for": Token.FOR,
  "while": Token.WHILE,
  #
  "fun": Token.FUN,
  "return": Token.RETURN,
  "in": Token.IN,
  "out": Token.OUT,
}.toTable

type Tokens = seq[(Token, Option[string])]

type Lexer* = ref object
  fs: FileStream
  tokens: Tokens
  line: int
  linePos: int

proc addToken(self: Lexer, token: Token) =
  self.tokens.add((token, none(string)))

proc addToken(self: Lexer, token: Token, value: string) =
  self.tokens.add((token, some(value)))

proc munch(self: Lexer, c: char): bool =
  if (self.fs.atEnd()):
    return false
  if (self.fs.peekChar() != c):
    return false

  discard self.fs.readChar()
  return true

proc stringToken(self: Lexer) =
  var s = ""
  var c = self.fs.readChar()
  while (c != '"'):
    if (self.fs.atEnd()):
      raise LexerException.newException(
        fmt"String was not closed at {self.line}:{self.linePos}"
      )

    c = self.fs.readChar()
    if (c == '\\'):
      s = s & self.fs.readChar()
    else:
      s = s & c

  self.addToken(Token.STRING, s)

proc numberToken(self: Lexer) =
  var s = ""
  var c = self.fs.readChar()
  while (isDigit(c)):
    if (self.fs.atEnd()):
      raise LexerException.newException(
        fmt"Number was not closed at {self.line}:{self.linePos}"
      )

    s = s & c
    c = self.fs.readChar()

  self.addToken(Token.NUMBER, s)

proc asciiToken(self: Lexer) =
  var s = ""
  var c = self.fs.readChar()
  while (isAlphaNumeric(c)):
    # if (self.fs.atEnd()):
    #     raise LexerException.newException(fmt"Number was not closed at {self.line}:{self.linePos}")

    s = s & c
    c = self.fs.readChar()

  if (Keywords.hasKey(s)):
    self.addToken(Keywords[s])
  else:
    self.addToken(Token.IDENTIFIER, s)

proc tokenize*(fs: FileStream): Tokens =
  let lexer = Lexer(fs: fs, tokens: @[], line: 1, linePos: 0)
  while not fs.atEnd():
    let c = fs.readChar()
    lexer.linePos += 1

    case (c)
    of '(':
      lexer.addToken(Token.LEFT_PAREN)
    of ')':
      lexer.addToken(Token.RIGHT_PAREN)
    of '{':
      lexer.addToken(Token.LEFT_BRACE)
    of '}':
      lexer.addToken(Token.RIGHT_BRACE)
    of ',':
      lexer.addToken(Token.COMMA)
    of '.':
      lexer.addToken(Token.DOT)
    of '-':
      lexer.addToken(Token.MINUS)
    of '+':
      lexer.addToken(Token.PLUS)
    of ';':
      lexer.addToken(Token.SEMICOLON)
    of '*':
      lexer.addToken(Token.STAR)
    of '!':
      lexer.addToken(if (lexer.munch('=')): Token.BANG_EQUAL else: Token.BANG)
    of '=':
      lexer.addToken(if (lexer.munch('=')): Token.EQUAL_EQUAL else: Token.EQUAL)
    of '<':
      lexer.addToken(if (lexer.munch('=')): Token.LESS_EQUAL else: Token.LESS)
    of '>':
      lexer.addToken(if (lexer.munch('=')): Token.GREATER_EQUAL else: Token.GREATER)
    of '&':
      lexer.addToken(if (lexer.munch('&')): Token.AND_AND else: Token.AND)
    of '|':
      lexer.addToken(if (lexer.munch('|')): Token.OR_OR else: Token.OR)
    of '/':
      if (lexer.munch('/')):
        while (fs.readChar() != '\n' and not fs.atEnd()):
          discard
      else:
        lexer.addToken(Token.SLASH)
    of '"':
      lexer.stringToken()
    of ' ':
      discard
    of '\r':
      discard
    of '\t':
      discard
    of '\n':
      lexer.line += 1
      lexer.linePos = 0
    else:
      if isDigit(c):
        lexer.numberToken()
      elif isAlphaAscii(c):
        lexer.asciiToken()
      else:
        raise LexerException.newException(
          fmt"Invalid token at {lexer.line}:{lexer.linePos}"
        )

  return lexer.tokens
