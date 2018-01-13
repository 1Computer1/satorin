class TokenRule {
    constructor(type, data) {
        this.type = type;

        if (typeof data === 'string') {
            this.regExp = TokenRule.encloseRegExp(TokenRule.escapeSpecial(data), true);
        } else if (data instanceof RegExp) {
            this.regExp = TokenRule.encloseRegExp(data.source);
        } else {
            this.regExp = data.match ? TokenRule.encloseRegExp(data.match.source) : null;
        }

        this.eof = data.eof === undefined ? false : data.eof;
        this.ignore = data.ignore === undefined ? false : data.ignore;

        if (data.keywords) {
            this.keywords = [];
            for (const [kwType, kwData] of Object.entries(data.keywords)) {
                this.keywords.push(new TokenRule(kwType, kwData));
            }
        } else {
            this.keywords = null;
        }
    }

    match(string) {
        if (!this.regExp) return null;
        return string.match(this.regExp);
    }

    static escapeSpecial(string) {
        return string.replace(/[|\\{}()[^$+*?.\]-]/g, '\\$&');
    }

    static encloseRegExp(string, boundary) {
        if (!/^\w+$/.test(string)) return new RegExp(`^(?:${string})`);
        return new RegExp(`^(?:${string}${boundary ? '\\b' : ''})`);
    }
}

module.exports = TokenRule;
