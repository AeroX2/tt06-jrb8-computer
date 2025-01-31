import options
import strutils

import tokens
import expressions

import printer

type Parser = object
    stream: TokenStream

proc peek(self: Parser): Token =
    return self.stream.peek().token

proc match(self: Parser, tokens: varargs[Token]): Option[Token] =
    for token in tokens:
        if (self.peek() == token):
            return some(token)
    return none(Token)

proc matchWithVal(self: Parser, tokens: varargs[Token]): Option[TokenObj] =
    for token in tokens:
        if (self.peek() == token):
            return some(self.stream.peek())
    return none(TokenObj)

proc expression(self: Parser): Expr

proc primary(self: Parser): Expr =
    if (self.match(Token.FALSE).isSome): 
        return LiteralBool(val: false)
    if (self.match(Token.TRUE).isSome): 
        return LiteralBool(val: true)

    var previous = self.matchWithVal(Token.NUMBER)
    if (previous.isSome):
        return LiteralNumber(val: parseInt(previous.get().value.get()))

    previous = self.matchWithVal(Token.STRING)
    if (previous.isSome):
        return LiteralString(val: previous.get().value.get())

    if (self.match(Token.LEFT_PAREN).isSome):
        result = self.expression()
        # self.consume(Token.RIGHT_PAREN)
        return Grouping(expression: result)

proc unary(self: Parser): Expr =
    var operator = self.match(Token.BANG, Token.MINUS)
    if (operator.isSome):
        let right = self.unary()
        return Unary(op: operator.get(), right: right)

    return self.primary()

proc factor(self: Parser): Expr =
    result = self.unary()
    echo result[]

    var operator = self.match(Token.SLASH, Token.STAR)
    while (operator.isSome):
        let right = self.unary()
        result = Binary(left: result, op: operator.get(), right: right)
        operator = self.match(Token.SLASH, Token.STAR)

proc term(self: Parser): Expr =
    result = self.factor()

    var operator = self.match(Token.GREATER, Token.GREATER_EQUAL, Token.LESS, Token.LESS_EQUAL)
    while (operator.isSome):
        let right = self.factor()
        result = Binary(left: result, op: operator.get(), right: right)
        operator = self.match(Token.GREATER, Token.GREATER_EQUAL, Token.LESS, Token.LESS_EQUAL)

proc comparison(self: Parser): Expr =
    result = self.term()

    var operator = self.match(Token.GREATER, Token.GREATER_EQUAL, Token.LESS, Token.LESS_EQUAL)
    while (operator.isSome):
        let right = self.term()
        result = Binary(left: result, op: operator.get(), right: right)
        operator = self.match(Token.GREATER, Token.GREATER_EQUAL, Token.LESS, Token.LESS_EQUAL)

proc equality(self: Parser): Expr = 
    result = self.comparison()

    var operator = self.match(Token.BANG_EQUAL, Token.EQUAL_EQUAL)
    while (operator.isSome):
        let right = self.comparison()
        result = Binary(left: result, op: operator.get(), right: right)
        operator = self.match(Token.BANG_EQUAL, Token.EQUAL_EQUAL)

proc expression(self: Parser): Expr = 
    return self.equality()

proc program(self: Parser): Expr =
    return self.expression()

proc parse*(tokens: Tokens): Expr =
    let stream = newTokenStream(tokens)
    let parser = Parser(stream: stream)
    let printer = ASTPrinter()

    let tree: Expr = Binary(
        left: LiteralNumber(val: 42),
        op: Token.PLUS,
        right: Grouping(expression: LiteralNumber(val: 3))
    )

    # let tree = parser.program()
    echo "plz"
    echo tree.accept(printer)

    return tree