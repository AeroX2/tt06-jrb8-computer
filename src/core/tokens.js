export var Token;
(function (Token) {
    // Single-character tokens
    Token["LEFT_PAREN"] = "(";
    Token["RIGHT_PAREN"] = ")";
    Token["LEFT_BRACE"] = "{";
    Token["RIGHT_BRACE"] = "}";
    Token["COMMA"] = ",";
    Token["DOT"] = ".";
    Token["MINUS"] = "-";
    Token["PLUS"] = "+";
    Token["SEMICOLON"] = ";";
    Token["SLASH"] = "/";
    Token["STAR"] = "*";
    // One or two character tokens
    Token["BANG"] = "!";
    Token["BANG_EQUAL"] = "!=";
    Token["EQUAL"] = "=";
    Token["EQUAL_EQUAL"] = "==";
    Token["GREATER"] = ">";
    Token["GREATER_EQUAL"] = ">=";
    Token["LESS"] = "<";
    Token["LESS_EQUAL"] = "<=";
    Token["AND"] = "&";
    Token["AND_AND"] = "&&";
    Token["OR"] = "|";
    Token["OR_OR"] = "||";
    // Literals
    Token["IDENTIFIER"] = "identifier";
    Token["STRING"] = "string";
    Token["NUMBER"] = "number";
    // Keywords
    Token["VAR"] = "var";
    Token["IF"] = "if";
    Token["ELSE"] = "else";
    Token["TRUE"] = "true";
    Token["FALSE"] = "false";
    Token["FOR"] = "for";
    Token["WHILE"] = "while";
    Token["FUN"] = "fun";
    Token["RETURN"] = "return";
    Token["IN"] = "in";
    Token["OUT"] = "out";
    // Specials
    Token["OVERFLOW"] = "overflow";
    Token["EOF"] = "eof";
})(Token || (Token = {}));
export class ParserException extends Error {
    constructor(message) {
        super(message);
        this.name = 'ParserException';
    }
}
export class TokenStream {
    buffer;
    position;
    constructor(data) {
        this.buffer = data;
        this.position = 0;
    }
    peek() {
        if (this.position < this.buffer.length) {
            return this.buffer[this.position];
        }
        throw new ParserException('Attempted to peek past the end of the stream');
    }
    read() {
        if (this.position < this.buffer.length) {
            return this.buffer[this.position++];
        }
        throw new ParserException('Attempted to read past the end of the stream');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9rZW5zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2NvcmUvdG9rZW5zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE1BQU0sQ0FBTixJQUFZLEtBNkNYO0FBN0NELFdBQVksS0FBSztJQUNmLDBCQUEwQjtJQUMxQix5QkFBZ0IsQ0FBQTtJQUNoQiwwQkFBaUIsQ0FBQTtJQUNqQix5QkFBZ0IsQ0FBQTtJQUNoQiwwQkFBaUIsQ0FBQTtJQUNqQixvQkFBVyxDQUFBO0lBQ1gsa0JBQVMsQ0FBQTtJQUNULG9CQUFXLENBQUE7SUFDWCxtQkFBVSxDQUFBO0lBQ1Ysd0JBQWUsQ0FBQTtJQUNmLG9CQUFXLENBQUE7SUFDWCxtQkFBVSxDQUFBO0lBQ1YsOEJBQThCO0lBQzlCLG1CQUFVLENBQUE7SUFDViwwQkFBaUIsQ0FBQTtJQUNqQixvQkFBVyxDQUFBO0lBQ1gsMkJBQWtCLENBQUE7SUFDbEIsc0JBQWEsQ0FBQTtJQUNiLDZCQUFvQixDQUFBO0lBQ3BCLG1CQUFVLENBQUE7SUFDViwwQkFBaUIsQ0FBQTtJQUNqQixrQkFBUyxDQUFBO0lBQ1QsdUJBQWMsQ0FBQTtJQUNkLGlCQUFRLENBQUE7SUFDUixxQkFBWSxDQUFBO0lBQ1osV0FBVztJQUNYLGtDQUF5QixDQUFBO0lBQ3pCLDBCQUFpQixDQUFBO0lBQ2pCLDBCQUFpQixDQUFBO0lBQ2pCLFdBQVc7SUFDWCxvQkFBVyxDQUFBO0lBQ1gsa0JBQVMsQ0FBQTtJQUNULHNCQUFhLENBQUE7SUFDYixzQkFBYSxDQUFBO0lBQ2Isd0JBQWUsQ0FBQTtJQUNmLG9CQUFXLENBQUE7SUFDWCx3QkFBZSxDQUFBO0lBQ2Ysb0JBQVcsQ0FBQTtJQUNYLDBCQUFpQixDQUFBO0lBQ2pCLGtCQUFTLENBQUE7SUFDVCxvQkFBVyxDQUFBO0lBQ1gsV0FBVztJQUNYLDhCQUFxQixDQUFBO0lBQ3JCLG9CQUFXLENBQUE7QUFDYixDQUFDLEVBN0NXLEtBQUssS0FBTCxLQUFLLFFBNkNoQjtBQVNELE1BQU0sT0FBTyxlQUFnQixTQUFRLEtBQUs7SUFDeEMsWUFBWSxPQUFlO1FBQ3pCLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNmLElBQUksQ0FBQyxJQUFJLEdBQUcsaUJBQWlCLENBQUM7SUFDaEMsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLFdBQVc7SUFDZCxNQUFNLENBQWE7SUFDbkIsUUFBUSxDQUFTO0lBRXpCLFlBQVksSUFBZ0I7UUFDMUIsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7UUFDbkIsSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7SUFDcEIsQ0FBQztJQUVELElBQUk7UUFDRixJQUFJLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN2QyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3BDLENBQUM7UUFDRCxNQUFNLElBQUksZUFBZSxDQUFDLDhDQUE4QyxDQUFDLENBQUM7SUFDNUUsQ0FBQztJQUVELElBQUk7UUFDRixJQUFJLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN2QyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDdEMsQ0FBQztRQUNELE1BQU0sSUFBSSxlQUFlLENBQUMsOENBQThDLENBQUMsQ0FBQztJQUM1RSxDQUFDO0NBQ0YifQ==