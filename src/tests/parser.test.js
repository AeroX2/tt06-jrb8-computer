import { Lexer } from "../core/lexer";
import { Parser } from "../core/parser";
import { ASTPrinter } from "../ast/printer";
describe("Parser Tests", () => {
    const runParserTest = (source, expectedAst) => {
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
        runParserTest(`var count = 5
var sum = 0
while (count > 0) {
    sum = sum + count
    count = count - 1
}
out sum`, `var count = 5
var sum = 0
while ([count > 0]) {
  sum = [sum + count]
  count = [count - 1]
}
out sum`);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvdGVzdHMvcGFyc2VyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUN0QyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDeEMsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBRTVDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsR0FBRyxFQUFFO0lBQzVCLE1BQU0sYUFBYSxHQUFHLENBQUMsTUFBYyxFQUFFLFdBQW1CLEVBQUUsRUFBRTtRQUM1RCxNQUFNLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNoQyxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDbEMsTUFBTSxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbEMsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzNCLE1BQU0sT0FBTyxHQUFHLElBQUksVUFBVSxFQUFFLENBQUM7UUFDakMsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbkUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUNwRCxDQUFDLENBQUM7SUFFRixJQUFJLENBQUMsNENBQTRDLEVBQUUsR0FBRyxFQUFFO1FBQ3RELGFBQWEsQ0FBQyxXQUFXLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDMUMsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsd0JBQXdCLEVBQUUsR0FBRyxFQUFFO1FBQ2xDLGFBQWEsQ0FBQyx3QkFBd0IsRUFBRSw0QkFBNEIsQ0FBQyxDQUFDO0lBQ3hFLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLFlBQVksRUFBRSxHQUFHLEVBQUU7UUFDdEIsYUFBYSxDQUFDLDZCQUE2QixFQUFFLHFDQUFxQyxDQUFDLENBQUM7SUFDdEYsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsa0JBQWtCLEVBQUUsR0FBRyxFQUFFO1FBQzVCLGFBQWEsQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDcEMsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsa0JBQWtCLEVBQUUsR0FBRyxFQUFFO1FBQzVCLGFBQWEsQ0FDWDs7Ozs7O1FBTUUsRUFDRjs7Ozs7O1FBTUUsQ0FDSCxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyJ9