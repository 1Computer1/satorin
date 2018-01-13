const ProductionRule = require('./ProductionRule');
const TokenRule = require('./TokenRule');

class Grammar {
    constructor({ suppressWarnings = false } = {}) {
        this.tokenRules = [];
        this.productionRules = Object.create(null);

        this.eofTokenRule = null;
        this.startProductionRule = null;

        this.suppressWarnings = suppressWarnings;
    }

    setTokens(tokenRules) {
        for (const [type, data] of Object.entries(tokenRules)) {
            this.tokenRules.push(new TokenRule(type, data));
        }

        const eofTokenRules = this.tokenRules.filter(t => t.eof);
        if (eofTokenRules.length !== 1) {
            throw new Error('There must be one EOF token rule');
        }

        this.eofTokenRule = eofTokenRules[0];
        return this;
    }

    setRules(productionRules) {
        if (!this.tokenRules.length) {
            throw new Error('Token rules must be set before production rules');
        }

        for (const [name, paths] of Object.entries(productionRules)) {
            this.productionRules[name] = new ProductionRule(name, paths);
        }

        this.startProductionRule = Object.values(this.productionRules)[0];
        if (this.startProductionRule.paths.length === 1) {
            const lastSymbol = this.startProductionRule.paths[0].is.slice(-1)[0];
            if (this.eofTokenRule.type !== lastSymbol) {
                throw new Error('Start production rule must only have one option ending with an EOF token');
            }
        } else {
            throw new Error('Start production rule must have one option ending with an EOF token');
        }

        return this;
    }
}

module.exports = Grammar;
