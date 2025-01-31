import strformat

import expressions

type ASTPrinter* = ref object of ExprVisitor[string]

proc visit*(self: ExprVisitor[string], v: Expr): string = 
    return "wrong!" #v.accept(self)

proc visitBinary*(self: ExprVisitor[string], v: Binary): string = 
    return fmt"( {v.left.accept(self)} {v.op} {v.right.accept(self)} )"

proc visitGrouping*(self: ExprVisitor[string], v: Grouping): string = 
    return fmt"( {v.expression.accept(self)} )"

proc visitUnary*(self: ExprVisitor[string], v: Unary): string = 
    return fmt"( {v.op} {v.right.accept(self)} )"

proc visitLiteralBool*(self: ExprVisitor[string], v: LiteralBool): string = 
    return fmt"{ v.val }"

proc visitLiteralString*(self: ExprVisitor[string], v: LiteralString): string = 
    return fmt"{ v.val }"

proc visitLiteralNumber*(self: ExprVisitor[string], v: LiteralNumber): string = 
    return fmt"{ v.val }"
