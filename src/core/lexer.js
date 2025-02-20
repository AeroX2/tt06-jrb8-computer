import { Token } from "./tokens";
export class LexerError extends Error {
    constructor(message) {
        super(message);
        this.name = "LexerError";
    }
}
const Keywords = {
    var: Token.VAR,
    if: Token.IF,
    else: Token.ELSE,
    true: Token.TRUE,
    false: Token.FALSE,
    for: Token.FOR,
    while: Token.WHILE,
    fun: Token.FUN,
    return: Token.RETURN,
    out: Token.OUT,
    in: Token.IN,
};
export class Lexer {
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
            value,
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
        return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
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
            // Consume 'x', 'o', or 'b'
            this.advance();
            // Select validator and base based on prefix
            const { fn: validator, base } = {
                x: {
                    fn: this.isHexDigit.bind(this),
                    base: 16,
                },
                o: {
                    fn: this.isOctalDigit.bind(this),
                    base: 8,
                },
                b: { fn: this.isBinaryDigit.bind(this), base: 2 },
            }[nextChar];
            // Process digits
            while (validator(this.peek())) {
                this.advance();
            }
            const value = this.source.substring(this.start + 2, this.current);
            this.addToken(Token.NUMBER, parseInt(value, base).toString());
            return;
        }
        while (this.isDigit(this.peek())) {
            this.advance();
        }
        const value = this.source.substring(this.start, this.current);
        this.addToken(Token.NUMBER, value);
    }
    string() {
        let value = "";
        while (this.peek() !== '"' && !this.isAtEnd()) {
            if (this.peek() === "\\") {
                this.advance(); // Consume the backslash
                value += this.advance(); // Add the escaped character
            }
            else {
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
    identifier() {
        while (this.isAlphaNumeric(this.peek())) {
            this.advance();
        }
        const text = this.source.substring(this.start, this.current);
        const token = Keywords[text] ?? Token.IDENTIFIER;
        this.addToken(token, text);
    }
    scanTokens() {
        while (!this.isAtEnd()) {
            this.start = this.current;
            this.scanToken();
        }
        this.addToken(Token.EOF);
        return this.tokens;
    }
    scanToken() {
        const c = this.advance();
        switch (c) {
            case "(":
                this.addToken(Token.LEFT_PAREN);
                break;
            case ")":
                this.addToken(Token.RIGHT_PAREN);
                break;
            case "{":
                this.addToken(Token.LEFT_BRACE);
                break;
            case "}":
                this.addToken(Token.RIGHT_BRACE);
                break;
            case ",":
                this.addToken(Token.COMMA);
                break;
            case ".":
                this.addToken(Token.DOT);
                break;
            case "-":
                this.addToken(Token.MINUS);
                break;
            case "+":
                this.addToken(Token.PLUS);
                break;
            case ";":
                this.addToken(Token.SEMICOLON);
                break;
            case "*":
                this.addToken(Token.STAR);
                break;
            case "~":
                this.addToken(Token.TILDE);
                break;
            case "!":
                this.addToken(this.match("=") ? Token.BANG_EQUAL : Token.BANG);
                break;
            case "=":
                this.addToken(this.match("=") ? Token.EQUAL_EQUAL : Token.EQUAL);
                break;
            case "<":
                this.addToken(this.match("=") ? Token.LESS_EQUAL : Token.LESS);
                break;
            case ">":
                this.addToken(this.match("=") ? Token.GREATER_EQUAL : Token.GREATER);
                break;
            case "&":
                this.addToken(this.match("&") ? Token.AND_AND : Token.AND);
                break;
            case "|":
                this.addToken(this.match("|") ? Token.OR_OR : Token.OR);
                break;
            case "/":
                if (this.match("/")) {
                    // A comment goes until the end of the line
                    while (this.peek() !== "\n" && !this.isAtEnd()) {
                        this.advance();
                    }
                }
                else {
                    this.addToken(Token.SLASH);
                }
                break;
            case '"':
                this.string();
                break;
            case " ":
            case "\r":
            case "\t":
                break;
            case "\n":
                this.line++;
                this.linePos = 0;
                break;
            default:
                if (this.isDigit(c)) {
                    this.number();
                }
                else if (this.isAlpha(c)) {
                    this.identifier();
                }
                else {
                    throw new LexerError(`Unexpected character at ${this.line}:${this.linePos}`);
                }
                break;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGV4ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29yZS9sZXhlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsS0FBSyxFQUFZLE1BQU0sVUFBVSxDQUFDO0FBRTNDLE1BQU0sT0FBTyxVQUFXLFNBQVEsS0FBSztJQUNuQyxZQUFZLE9BQWU7UUFDekIsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2YsSUFBSSxDQUFDLElBQUksR0FBRyxZQUFZLENBQUM7SUFDM0IsQ0FBQztDQUNGO0FBRUQsTUFBTSxRQUFRLEdBQTBCO0lBQ3RDLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRztJQUNkLEVBQUUsRUFBRSxLQUFLLENBQUMsRUFBRTtJQUNaLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSTtJQUNoQixJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUk7SUFDaEIsS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLO0lBQ2xCLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRztJQUNkLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSztJQUNsQixHQUFHLEVBQUUsS0FBSyxDQUFDLEdBQUc7SUFDZCxNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU07SUFDcEIsR0FBRyxFQUFFLEtBQUssQ0FBQyxHQUFHO0lBQ2QsRUFBRSxFQUFFLEtBQUssQ0FBQyxFQUFFO0NBQ2IsQ0FBQztBQUVGLE1BQU0sT0FBTyxLQUFLO0lBQ0MsTUFBTSxDQUFTO0lBQ2YsTUFBTSxHQUFlLEVBQUUsQ0FBQztJQUNqQyxLQUFLLEdBQUcsQ0FBQyxDQUFDO0lBQ1YsT0FBTyxHQUFHLENBQUMsQ0FBQztJQUNaLElBQUksR0FBRyxDQUFDLENBQUM7SUFDVCxPQUFPLEdBQUcsQ0FBQyxDQUFDO0lBRXBCLFlBQVksTUFBYztRQUN4QixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztJQUN2QixDQUFDO0lBRU8sT0FBTztRQUNiLE9BQU8sSUFBSSxDQUFD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LENBQUM7UUFFRCxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN6QixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDckIsQ0FBQztJQUVPLFNBQVM7UUFDZixNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDekIsUUFBUSxDQUFDLEVBQUUsQ0FBQztZQUNWLEtBQUssR0FBRztnQkFDTixJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDaEMsTUFBTTtZQUNSLEtBQUssR0FBRztnQkFDTixJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFDakMsTUFBTTtZQUNSLEtBQUssR0FBRztnQkFDTixJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDaEMsTUFBTTtZQUNSLEtBQUssR0FBRztnQkFDTixJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFDakMsTUFBTTtZQUNSLEtBQUssR0FBRztnQkFDTixJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDM0IsTUFBTTtZQUNSLEtBQUssR0FBRztnQkFDTixJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDekIsTUFBTTtZQUNSLEtBQUssR0FBRztnQkFDTixJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDM0IsTUFBTTtZQUNSLEtBQUssR0FBRztnQkFDTixJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDMUIsTUFBTTtZQUNSLEtBQUssR0FBRztnQkFDTixJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDL0IsTUFBTTtZQUNSLEtBQUssR0FBRztnQkFDTixJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDMUIsTUFBTTtZQUNSLEtBQUssR0FBRztnQkFDTixJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDM0IsTUFBTTtZQUNSLEtBQUssR0FBRztnQkFDTixJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDL0QsTUFBTTtZQUNSLEtBQUssR0FBRztnQkFDTixJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDakUsTUFBTTtZQUNSLEtBQUssR0FBRztnQkFDTixJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDL0QsTUFBTTtZQUNSLEtBQUssR0FBRztnQkFDTixJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDckUsTUFBTTtZQUNSLEtBQUssR0FBRztnQkFDTixJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDM0QsTUFBTTtZQUNSLEtBQUssR0FBRztnQkFDTixJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDeEQsTUFBTTtZQUNSLEtBQUssR0FBRztnQkFDTixJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztvQkFDcEIsMkNBQTJDO29CQUMzQyxPQUFPLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQzt3QkFDL0MsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO29CQUNqQixDQUFDO2dCQUNILENBQUM7cUJBQU0sQ0FBQztvQkFDTixJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDN0IsQ0FBQztnQkFDRCxNQUFNO1lBQ1IsS0FBSyxHQUFHO2dCQUNOLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDZCxNQUFNO1lBRVIsS0FBSyxHQUFHLENBQUM7WUFDVCxLQUFLLElBQUksQ0FBQztZQUNWLEtBQUssSUFBSTtnQkFDUCxNQUFNO1lBQ1IsS0FBSyxJQUFJO2dCQUNQLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDWixJQUFJLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQztnQkFDakIsTUFBTTtZQUVSO2dCQUNFLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO29CQUNwQixJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ2hCLENBQUM7cUJBQU0sSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7b0JBQzNCLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQkFDcEIsQ0FBQztxQkFBTSxDQUFDO29CQUNOLE1BQU0sSUFBSSxVQUFVLENBQUMsMkJBQTJCLElBQUksQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7Z0JBQy9FLENBQUM7Z0JBQ0QsTUFBTTtRQUNWLENBQUM7SUFDSCxDQUFDO0NBQ0YifQ==