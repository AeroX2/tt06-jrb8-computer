import { Lexer } from "../core/lexer";
import { Parser } from "../core/parser";
import { ASTPrinter } from "../ast/printer";

describe("Parser Tests", () => {
  const runParserTest = (source: string, expectedAst: string) => {
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const printer = new ASTPrinter();
    const actualAst = ast.map(stmt => stmt.accept(printer)).join("\n");
    expect(actualAst.trim()).toBe(expectedAst.trim());
  };

  test("simple variable declaration and assignment", () => {
    runParserTest("var x = 5", "var x = 5");
  });

  test("arithmetic expressions", () => {
    runParserTest("var result = 2 + 3 * 4", "var result = [2 + [3 * 4]]");
  });

  test("while loop", () => {
    runParserTest("while (x > 0) { x = x - 1 }", "while ([x > 0]) {\n  x = [x - 1]\n}");
  });

  test("output statement", () => {
    runParserTest("out 42", "out 42");
  });

  test("complete program", () => {
    runParserTest(
      `var count = 5
var sum = 0
while (count > 0) {
    sum = sum + count
    count = count - 1
}
out sum`,
      `var count = 5
var sum = 0
while ([count > 0]) {
  sum = [sum + count]
  count = [count - 1]
}
out sum`
    );
  });
});
