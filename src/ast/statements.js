export class Stmt {
}
export class Expression extends Stmt {
    expression;
    constructor(expression) {
        super();
        this.expression = expression;
    }
    accept(visitor) {
        return visitor.visitExpressionStmt(this);
    }
}
export class If extends Stmt {
    condition;
    thenBranch;
    elseBranch;
    constructor(condition, thenBranch, elseBranch) {
        super();
        this.condition = condition;
        this.thenBranch = thenBranch;
        this.elseBranch = elseBranch;
    }
    accept(visitor) {
        return visitor.visitIfStmt(this);
    }
}
export class While extends Stmt {
    condition;
    body;
    constructor(condition, body) {
        super();
        this.condition = condition;
        this.body = body;
    }
    accept(visitor) {
        return visitor.visitWhileStmt(this);
    }
}
export class For extends Stmt {
    initializer;
    condition;
    increment;
    body;
    constructor(initializer, condition, increment, body) {
        super();
        this.initializer = initializer;
        this.condition = condition;
        this.increment = increment;
        this.body = body;
    }
    accept(visitor) {
        return visitor.visitForStmt(this);
    }
}
export class Block extends Stmt {
    statements;
    constructor(statements) {
        super();
        this.statements = statements;
    }
    accept(visitor) {
        return visitor.visitBlockStmt(this);
    }
}
export class Var extends Stmt {
    name;
    initializer;
    constructor(name, initializer) {
        super();
        this.name = name;
        this.initializer = initializer;
    }
    accept(visitor) {
        return visitor.visitVarStmt(this);
    }
}
export class Function extends Stmt {
    name;
    params;
    body;
    constructor(name, params, body) {
        super();
        this.name = name;
        this.params = params;
        this.body = body;
    }
    accept(visitor) {
        return visitor.visitFunctionStmt(this);
    }
}
export class Return extends Stmt {
    value;
    constructor(value) {
        super();
        this.value = value;
    }
    accept(visitor) {
        return visitor.visitReturnStmt(this);
    }
}
export class Output extends Stmt {
    expression;
    constructor(expression) {
        super();
        this.expression = expression;
    }
    accept(visitor) {
        return visitor.visitOutputStmt(this);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGVtZW50cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9hc3Qvc3RhdGVtZW50cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFjQSxNQUFNLE9BQWdCLElBQUk7Q0FFekI7QUFFRCxNQUFNLE9BQU8sVUFBVyxTQUFRLElBQUk7SUFDZjtJQUFuQixZQUFtQixVQUFnQjtRQUNqQyxLQUFLLEVBQUUsQ0FBQztRQURTLGVBQVUsR0FBVixVQUFVLENBQU07SUFFbkMsQ0FBQztJQUVELE1BQU0sQ0FBSSxPQUF1QjtRQUMvQixPQUFPLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUMzQyxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sRUFBRyxTQUFRLElBQUk7SUFFakI7SUFDQTtJQUNBO0lBSFQsWUFDUyxTQUFlLEVBQ2YsVUFBZ0IsRUFDaEIsVUFBdUI7UUFFOUIsS0FBSyxFQUFFLENBQUM7UUFKRCxjQUFTLEdBQVQsU0FBUyxDQUFNO1FBQ2YsZUFBVSxHQUFWLFVBQVUsQ0FBTTtRQUNoQixlQUFVLEdBQVYsVUFBVSxDQUFhO0lBR2hDLENBQUM7SUFFRCxNQUFNLENBQUksT0FBdUI7UUFDL0IsT0FBTyxPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ25DLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxLQUFNLFNBQVEsSUFBSTtJQUVwQjtJQUNBO0lBRlQsWUFDUyxTQUFlLEVBQ2YsSUFBVTtRQUVqQixLQUFLLEVBQUUsQ0FBQztRQUhELGNBQVMsR0FBVCxTQUFTLENBQU07UUFDZixTQUFJLEdBQUosSUFBSSxDQUFNO0lBR25CLENBQUM7SUFFRCxNQUFNLENBQUksT0FBdUI7UUFDL0IsT0FBTyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3RDLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxHQUFJLFNBQVEsSUFBSTtJQUVsQjtJQUNBO0lBQ0E7SUFDQTtJQUpULFlBQ1MsV0FBd0IsRUFDeEIsU0FBc0IsRUFDdEIsU0FBc0IsRUFDdEIsSUFBVTtRQUVqQixLQUFLLEVBQUUsQ0FBQztRQUxELGdCQUFXLEdBQVgsV0FBVyxDQUFhO1FBQ3hCLGNBQVMsR0FBVCxTQUFTLENBQWE7UUFDdEIsY0FBUyxHQUFULFNBQVMsQ0FBYTtRQUN0QixTQUFJLEdBQUosSUFBSSxDQUFNO0lBR25CLENBQUM7SUFFRCxNQUFNLENBQUksT0FBdUI7UUFDL0IsT0FBTyxPQUFPLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3BDLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxLQUFNLFNBQVEsSUFBSTtJQUNWO0lBQW5CLFlBQW1CLFVBQWtCO1FBQ25DLEtBQUssRUFBRSxDQUFDO1FBRFMsZUFBVSxHQUFWLFVBQVUsQ0FBUTtJQUVyQyxDQUFDO0lBRUQsTUFBTSxDQUFJLE9BQXVCO1FBQy9CLE9BQU8sT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN0QyxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sR0FBSSxTQUFRLElBQUk7SUFFbEI7SUFDQTtJQUZULFlBQ1MsSUFBWSxFQUNaLFdBQXdCO1FBRS9CLEtBQUssRUFBRSxDQUFDO1FBSEQsU0FBSSxHQUFKLElBQUksQ0FBUTtRQUNaLGdCQUFXLEdBQVgsV0FBVyxDQUFhO0lBR2pDLENBQUM7SUFFRCxNQUFNLENBQUksT0FBdUI7UUFDL0IsT0FBTyxPQUFPLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3BDLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxRQUFTLFNBQVEsSUFBSTtJQUV2QjtJQUNBO0lBQ0E7SUFIVCxZQUNTLElBQVksRUFDWixNQUFnQixFQUNoQixJQUFZO1FBRW5CLEtBQUssRUFBRSxDQUFDO1FBSkQsU0FBSSxHQUFKLElBQUksQ0FBUTtRQUNaLFdBQU0sR0FBTixNQUFNLENBQVU7UUFDaEIsU0FBSSxHQUFKLElBQUksQ0FBUTtJQUdyQixDQUFDO0lBRUQsTUFBTSxDQUFJLE9BQXVCO1FBQy9CLE9BQU8sT0FBTyxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3pDLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxNQUFPLFNBQVEsSUFBSTtJQUNYO0lBQW5CLFlBQW1CLEtBQWtCO1FBQ25DLEtBQUssRUFBRSxDQUFDO1FBRFMsVUFBSyxHQUFMLEtBQUssQ0FBYTtJQUVyQyxDQUFDO0lBRUQsTUFBTSxDQUFJLE9BQXVCO1FBQy9CLE9BQU8sT0FBTyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN2QyxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sTUFBTyxTQUFRLElBQUk7SUFDWDtJQUFuQixZQUFtQixVQUFnQjtRQUNqQyxLQUFLLEVBQUUsQ0FBQztRQURTLGVBQVUsR0FBVixVQUFVLENBQU07SUFFbkMsQ0FBQztJQUVELE1BQU0sQ0FBSSxPQUF1QjtRQUMvQixPQUFPLE9BQU8sQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDdkMsQ0FBQztDQUNGIn0=