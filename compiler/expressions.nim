import tokens

type ExprVisitor*[T] = ref object of RootObj

type Expr* = ref object of RootObj

type Binary* = ref object of Expr
    left*: Expr
    op*: Token
    right*: Expr

type Grouping* = ref object of Expr
    expression*: Expr

type Unary* = ref object of Expr
    op*: Token
    right*: Expr

type LiteralBool* = ref object of Expr
    val*: bool

type LiteralString* = ref object of Expr
    val*: string

type LiteralNumber* = ref object of Expr
    val*: int

# method visit[T](self: ExprVisitor[T], v: Expr): T = 
#     echo "hi"
#     discard

# method visitBinary[T](self: ExprVisitor[T], v: Binary): T = 
#     discard

# method visitGrouping[T](self: ExprVisitor[T], v: Grouping): T = 
#     discard

# method visitUnary[T](self: ExprVisitor[T], v: Unary): T = 
#     discard

# method visitLiteralBool[T](self: ExprVisitor[T], v: LiteralBool): T = 
#     discard

# method visitLiteralString[T](self: ExprVisitor[T], v: LiteralString): T = 
#     discard

# method visitLiteralNumber[T](self: ExprVisitor[T], v: LiteralNumber): T = 
#     discard

proc accept*[T](self: Expr, visitor: ExprVisitor[T]): T =
    visitor.visit(self)

proc accept*[T](self: Binary, visitor: ExprVisitor[T]): T =
    visitor.visitBinary(self)

proc accept*[T](self: Grouping, visitor: ExprVisitor[T]): T =
    visitor.visitGrouping(self)

proc accept*[T](self: Unary, visitor: ExprVisitor[T]): T =
    visitor.visitUnary(self)

proc accept*[T](self: LiteralBool, visitor: ExprVisitor[T]): T =
    visitor.visitLiteralBool(self)

proc accept*[T](self: LiteralString, visitor: ExprVisitor[T]): T =
    visitor.visitLiteralString(self)

proc accept*[T](self: LiteralNumber, visitor: ExprVisitor[T]): T =
    visitor.visitLiteralNumber(self)