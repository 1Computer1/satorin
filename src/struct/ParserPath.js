class ParserPath {
    constructor(parser, lexer) {
        this.parser = parser;
        this.lexer = lexer;
        this.lexerState = lexer.save();

        this.stateStack = [0];
        this.parseStack = [];
        this.lookahead = null;
    }

    get state() {
        return this.stateStack[this.stateStack.length - 1];
    }

    scan() {
        this.lookahead = this.lexer.next();
    }

    shift(action) {
        this.parseStack.push(this.lookahead);
        this.scan();
        this.stateStack.push(action.shift);
    }

    reduce(action) {
        const removed = this.parseStack.splice(this.parseStack.length - action.reduce.length, action.reduce.length);
        this.stateStack.splice(this.stateStack.length - action.reduce.length, action.reduce.length);

        const returnValue = action.reduce.run(removed);
        const goto = this.parser.parseTable.goto[this.state][action.reduce.lhs][0];

        this.parseStack.push(returnValue);
        this.stateStack.push(goto.state);
    }

    run() {
        this.scan();

        let accepted = false;
        while (this.lookahead) {
            const action = this.parser.parseTable.action[this.state][this.lookahead.type][0];

            if (!action) {
                throw new Error(`Unexpected end of input at ${this.lexer.currentLine}:${this.lexer.currentColumn}`);
            }

            if (action.shift) {
                this.shift(action);
            } else if (action.reduce) {
                this.reduce(action);
            } else if (action.accept) {
                accepted = true;
                this.lookahead = null;
            }
        }

        if (!accepted) {
            throw new Error(`Unexpected end of input at ${this.lexer.currentLine}:${this.lexer.currentColumn}`);
        }

        return this.parseStack[0];
    }
}

module.exports = ParserPath;
