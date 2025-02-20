export class Expr {
}
export class Binary extends Expr {
    left;
    op;
    right;
    constructor(left, op, right) {
        super();
        this.left = left;
        this.op = op;
        this.right = right;
    }
    accept(visitor) {
        return visitor.visitBinary(this);
    }
}
export class Grouping extends Expr {
    expression;
    constructor(expression) {
        super();
        this.expression = expression;
    }
    accept(visitor) {
        return visitor.visitGrouping(this);
    }
}
export class Unary extends Expr {
    op;
    right;
    constructor(op, right) {
        super();
        this.op = op;
        this.right = right;
    }
    accept(visitor) {
        return visitor.visitUnary(this);
    }
}
export class LiteralBool extends Expr {
    val;
    constructor(val) {
        super();
        this.val = val;
    }
    accept(visitor) {
        return visitor.visitLiteralBool(this);
    }
}
export class LiteralString extends Expr {
    val;
    constructor(val) {
        super();
        this.val = val;
    }
    accept(visitor) {
        return visitor.visitLiteralString(this);
    }
}
export class LiteralNumber extends Expr {
    val;
    constructor(val) {
        super();
        this.val = val;
    }
    accept(visitor) {
        return visitor.visitLiteralNumber(this);
    }
}
export class Variable extends Expr {
    name;
    constructor(name) {
        super();
        this.name = name;
    }
    accept(visitor) {
        return visitor.visitVariable(this);
    }
}
export class Assign extends Expr {
    name;
    value;
    constructor(name, value) {
        super();
        this.name = name;
        this.value = value;
    }
    accept(visitor) {
        return visitor.visitAssign(this);
    }
}
export class Logical extends Expr {
    left;
    op;
    right;
    constructor(left, op, right) {
        super();
        this.left = left;
        this.op = op;
        this.right = right;
    }
    accept(visitor) {
        return visitor.visitLogical(this);
    }
}
export class Call extends Expr {
    callee;
    paren;
    args;
    constructor(callee, paren, args) {
        super();
        this.callee = callee;
        this.paren = paren;
        this.args = args;
    }
    accept(visitor) {
        return visitor.visitCall(this);
    }
}
export class Input extends Expr {
    constructor() {
        super();
    }
    accept(visitor) {
        return visitor.visitInput(this);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwcmVzc2lvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvYXN0L2V4cHJlc3Npb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQWlCQSxNQUFNLE9BQWdCLElBQUk7Q0FFekI7QUFFRCxNQUFNLE9BQU8sTUFBTyxTQUFRLElBQUk7SUFFckI7SUFDQTtJQUNBO0lBSFQsWUFDUyxJQUFVLEVBQ1YsRUFBUyxFQUNULEtBQVc7UUFFbEIsS0FBSyxFQUFFLENBQUM7UUFKRCxTQUFJLEdBQUosSUFBSSxDQUFNO1FBQ1YsT0FBRSxHQUFGLEVBQUUsQ0FBTztRQUNULFVBQUssR0FBTCxLQUFLLENBQU07SUFHcEIsQ0FBQztJQUVELE1BQU0sQ0FBSSxPQUF1QjtRQUMvQixPQUFPLE9BQU8sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbkMsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLFFBQVMsU0FBUSxJQUFJO0lBQ2I7SUFBbkIsWUFBbUIsVUFBZ0I7UUFDakMsS0FBSyxFQUFFLENBQUM7UUFEUyxlQUFVLEdBQVYsVUFBVSxDQUFNO0lBRW5DLENBQUM7SUFFRCxNQUFNLENBQUksT0FBdUI7UUFDL0IsT0FBTyxPQUFPLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3JDLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxLQUFNLFNBQVEsSUFBSTtJQUVwQjtJQUNBO0lBRlQsWUFDUyxFQUFTLEVBQ1QsS0FBVztRQUVsQixLQUFLLEVBQUUsQ0FBQztRQUhELE9BQUUsR0FBRixFQUFFLENBQU87UUFDVCxVQUFLLEdBQUwsS0FBSyxDQUFNO0lBR3BCLENBQUM7SUFFRCxNQUFNLENBQUksT0FBdUI7UUFDL0IsT0FBTyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2xDLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxXQUFZLFNBQVEsSUFBSTtJQUNoQjtJQUFuQixZQUFtQixHQUFZO1FB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