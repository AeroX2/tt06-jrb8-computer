import { Lexer } from '../core/lexer';
import { Token } from '../core/tokens';

describe('Lexer Tests', () => {
  const runLexerTest = (source: string, expectedTokens: Token[]) => {
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();
    const tokenTypes = tokens.map(t => t.token);
    expect(tokenTypes).toEqual(expectedTokens);
  };

  test('simple variable declaration and assignment', () => {
    runLexerTest(
      'var x = 5',
      [Token.VAR, Token.IDENTIFIER, Token.EQUAL, Token.NUMBER, Token.EOF]
    );
  });

  test('arithmetic expressions', () => {
    runLexerTest(
      'var result = 2 + 3 * 4',
      [Token.VAR, Token.IDENTIFIER, Token.EQUAL, Token.NUMBER, Token.PLUS, Token.NUMBER, Token.STAR, Token.NUMBER, Token.EOF]
    );
  });

  test('while loop', () => {
    runLexerTest(
      'while (x > 0) { x = x - 1 }',
      [
        Token.WHILE, Token.LEFT_PAREN, Token.IDENTIFIER, Token.GREATER, Token.NUMBER,
        Token.RIGHT_PAREN, Token.LEFT_BRACE, Token.IDENTIFIER, Token.EQUAL,
        Token.IDENTIFIER, Token.MINUS, Token.NUMBER, Token.RIGHT_BRACE, Token.EOF
      ]
    );
  });

  test('output statement', () => {
    runLexerTest(
      'out 42',
      [Token.OUT, Token.NUMBER, Token.EOF]
    );
  });

  test('complete program', () => {
    runLexerTest(
      `var count = 5
var sum = 0
while (count > 0) {
    sum = sum + count
    count = count - 1
}
out sum`,
      [
        Token.VAR, Token.IDENTIFIER, Token.EQUAL, Token.NUMBER,
        Token.VAR, Token.IDENTIFIER, Token.EQUAL, Token.NUMBER,
        Token.WHILE, Token.LEFT_PAREN, Token.IDENTIFIER, Token.GREATER, Token.NUMBER,
        Token.RIGHT_PAREN, Token.LEFT_BRACE,
        Token.IDENTIFIER, Token.EQUAL, Token.IDENTIFIER, Token.PLUS, Token.IDENTIFIER,
        Token.IDENTIFIER, Token.EQUAL, Token.IDENTIFIER, Token.MINUS, Token.NUMBER,
        Token.RIGHT_BRACE,
        Token.OUT, Token.IDENTIFIER,
        Token.EOF
      ]
    );
  });
}); 