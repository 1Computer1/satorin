const Token = require('./Token');

class Lexer {
    constructor(inputText, tokenRules) {
        this.inputText = inputText;
        this.tokenRules = tokenRules;

        this.currentInput = inputText;
        this.currentPosition = 0;

        this.currentLine = 1;
        this.previousLine = 1;
        this.currentColumn = 0;
        this.previousColumn = 0;

        this.done = false;
    }

    error() {
        return new Error(`Unexpected token ${this.inputText[this.currentPosition]} at ${this.currentLine}:${this.currentColumn}`);
    }

    makeToken(tokenRules, value) {
        return new Token(tokenRules, value, {
            posStart: this.currentPosition - value.length,
            posEnd: this.currentPosition,
            lineStart: this.previousLine,
            lineEnd: this.currentLine,
            colStart: this.previousColumn,
            colEnd: this.currentColumn
        });
    }

    _next() {
        if (this.done) return null;

        for (const tokenRule of this.tokenRules) {
            if (this.currentInput === '') {
                this.done = true;
                if (tokenRule.eof) return this.makeToken(tokenRule, '');
                continue;
            }

            const match = tokenRule.match(this.currentInput);
            if (!match) continue;

            this.currentInput = this.currentInput.slice(match[0].length);
            this.currentPosition += match[0].length;

            const lines = match[0].match(/(?:\r\n?|\n).*/g);
            this.previousLine = this.currentLine;
            if (lines) {
                this.currentLine += lines.length;
                this.previousColumn = 0;
                this.currentColumn = match[0].length - lines.length;
            } else {
                this.previousColumn = this.currentColumn;
                this.currentColumn += match[0].length;
            }

            if (tokenRule.keywords) {
                for (const kwTokenRule of tokenRule.keywords) {
                    if (kwTokenRule.match(match[0])) {
                        return this.makeToken(kwTokenRule, match[0]);
                    }
                }
            }

            return this.makeToken(tokenRule, match[0]);
        }

        return null;
    }

    next() {
        if (this.done) return null;
        const token = this._next();
        if (token === null) throw this.error();
        if (token.rule.ignore) return this.next();
        return token;
    }

    save() {
        return {
            currentPosition: this.currentPosition,
            currentLine: this.currentLine,
            previousLine: this.previousLine,
            currentColumn: this.currentColumn,
            previousColumn: this.previousColumn,
            done: this.done
        };
    }

    load(location) {
        this.currentPosition = location.currentPosition;
        this.currentLine = location.currentLine;
        this.previousLine = location.previousLine;
        this.currentColumn = location.currentColumn;
        this.previousColumn = location.previousColumn;
        this.done = location.done;
        this.currentInput = this.inputText.slice(this.currentPosition);
    }

    *[Symbol.iterator]() {
        while (!this.done) {
            yield this.next();
        }
    }
}

module.exports = Lexer;
