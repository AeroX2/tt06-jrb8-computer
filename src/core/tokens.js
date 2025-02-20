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
    Token["TILDE"] = "~";
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
        this.name = "ParserException";
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
        throw new ParserException("Attempted to peek past the end of the stream");
    }
    read() {
        if (this.position < this.buffer.length) {
            return this.buffer[this.position++];
        }
        throw new ParserException("Attempted to read past the end of the stream");
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9rZW5zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2NvcmUvdG9rZW5zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE1BQU0sQ0FBTixJQUFZLEtBOENYO0FBOUNELFdBQVksS0FBSztJQUNmLDBCQUEwQjtJQUMxQix5QkFBZ0IsQ0FBQTtJQUNoQiwwQkFBaUIsQ0FBQTtJQUNqQix5QkFBZ0IsQ0FBQTtJQUNoQiwwQkFBaUIsQ0FBQTtJQUNqQixvQkFBVyxDQUFBO0lBQ1gsa0JBQVMsQ0FBQTtJQUNULG9CQUFXLENBQUE7SUFDWCxtQkFBVSxDQUFBO0lBQ1Ysd0JBQWUsQ0FBQTtJQUNmLG9CQUFXLENBQUE7SUFDWCxtQkFBVSxDQUFBO0lBQ1Ysb0JBQVcsQ0FBQTtJQUNYLDhCQUE4QjtJQUM5QixtQkFBVSxDQUFBO0lBQ1YsMEJBQWlCLENBQUE7SUFDakIsb0JBQVcsQ0FBQTtJQUNYLDJCQUFrQixDQUFBO0lBQ2xCLHNCQUFhLENBQUE7SUFDYiw2QkFBb0IsQ0FBQTtJQUNwQixtQkFBVSxDQUFBO0lBQ1YsMEJBQWlCLENBQUE7SUFDakIsa0JBQVMsQ0FBQTtJQUNULHVCQUFjLENBQUE7SUFDZCxpQkFBUSxDQUFBO0lBQ1IscUJBQVksQ0FBQTtJQUNaLFdBQVc7SUFDWCxrQ0FBeUIsQ0FBQTtJQUN6QiwwQkFBaUIsQ0FBQTtJQUNqQiwwQkFBaUIsQ0FBQTtJQUNqQixXQUFXO0lBQ1gsb0JBQVcsQ0FBQTtJQUNYLGtCQUFTLENBQUE7SUFDVCxzQkFBYSxDQUFBO0lBQ2Isc0JBQWEsQ0FBQTtJQUNiLHdCQUFlLENBQUE7SUFDZixvQkFBVyxDQUFBO0lBQ1gsd0JBQWUsQ0FBQTtJQUNmLG9CQUFXLENBQUE7SUFDWCwwQkFBaUIsQ0FBQTtJQUNqQixrQkFBUyxDQUFBO0lBQ1Qsb0JBQVcsQ0FBQTtJQUNYLFdBQVc7SUFDWCw4QkFBcUIsQ0FBQTtJQUNyQixvQkFBVyxDQUFBO0FBQ2IsQ0FBQyxFQTlDVyxLQUFLLEtBQUwsS0FBSyxRQThDaEI7QUFTRCxNQUFNLE9BQU8sZUFBZ0IsU0FBUSxLQUFLO0lBQ3hDLFlBQVksT0FBZTtRQUN6QixLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDZixJQUFJLENBQUMsSUFBSSxHQUFHLGlCQUFpQixDQUFDO0lBQ2hDLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxXQUFXO0lBQ0wsTUFBTSxDQUFhO0lBQzVCLFFBQVEsQ0FBUztJQUV6QixZQUFZLElBQWdCO1FBQzFCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO1FBQ25CLElBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDO0lBQ3BCLENBQUM7SUFFRCxJQUFJO1FBQ0YsSUFBSSxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDdkMsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNwQyxDQUFDO1FBQ0QsTUFBTSxJQUFJLGVBQWUsQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDO0lBQzVFLENBQUM7SUFFRCxJQUFJO1FBQ0YsSUFBSSxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDdkMsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQ3RDLENBQUM7UUFDRCxNQUFNLElBQUksZUFBZSxDQUFDLDhDQUE4QyxDQUFDLENBQUM7SUFDNUUsQ0FBQztDQUNGIn0=