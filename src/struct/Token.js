class Token {
    constructor(rule, value, location) {
        this.rule = rule;
        this.value = value;
        this.location = location;
    }

    get type() {
        return this.rule.type;
    }
}

module.exports = Token;
