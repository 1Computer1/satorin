const util = require('util');

const Lexer = require('./Lexer');
const ParserPath = require('./ParserPath');

const defaultAction = $ => $[0];

class Parser {
    constructor(grammar) {
        this.grammar = grammar;
        this.parseTable = this.generateParseTable();
    }

    separateItems(set) {
        return Object.values(set.reduce((acc, state) => {
            const symbol = state.symbol;
            if (!symbol) return acc;

            if (acc[symbol]) {
                acc[symbol].push(state);
                return acc;
            }

            acc[symbol] = [state];
            return acc;
        }, Object.create(null)));
    }

    getClosures(set) {
        const res = [];
        const search = sym => {
            // Make sure this is a non terminal
            const rule = this.grammar.productionRules[sym];
            if (!rule) return;

            for (let i = 0; i < rule.paths.length; i++) {
                const path = rule.paths[i];
                if (res.find(s => s.path === path.is)) continue;
                res.push(new ParserItem(rule, i, 0));
                search(path.is[0]);
            }
        };

        for (const item of set) search(item.symbol);
        return [...set, ...res];
    }

    generateParseTable() {
        const itemSets = [];
        const transitions = [];

        const generate = (set, setNumber) => {
            // Make sure set has items where the dot will not move past the end or an EOF
            const filteredSet = set.filter(item => item.symbol && item.symbol !== this.grammar.eofTokenRule.type);
            if (filteredSet.length === 0) return;

            // Keeps track of where a new set would end up at
            let count = itemSets.length;
            const resultingSets = [];

            // Separate the rules into sets where each rule has the same symbol at the dot
            for (const separateSet of this.separateItems(filteredSet)) {
                const movedSet = [];
                // Move the dot over for every item
                for (const item of separateSet) {
                    movedSet.push(item.move());
                }

                // Get the closure of the moved set
                const closedSet = this.getClosures(movedSet);

                // Find a conflicting set, i.e. same items
                // Order is guaranteed so checking by index is fine
                const conflictSetIndex = itemSets.findIndex(itemSet => {
                    if (closedSet.length !== itemSet.length) return false;
                    return closedSet.every((item, i) => item.equals(itemSet[i]));
                });

                if (conflictSetIndex === -1) {
                    // If a conflict is not found, make a new set and transition to that
                    resultingSets.push(closedSet);
                    transitions.push(new ParserTransition(setNumber, count, separateSet[0].symbol));
                    count++;
                } else {
                    // If a conflict is found, make a transition to the conflict set
                    transitions.push(new ParserTransition(setNumber, conflictSetIndex, separateSet[0].symbol));
                }
            }

            const setNumbers = [];
            for (const resultSet of resultingSets) {
                // Sets are added to the final item sets here
                setNumbers.push(itemSets.push(resultSet) - 1);
            }

            for (let i = 0; i < resultingSets.length; i++) {
                generate(resultingSets[i], setNumbers[i]);
            }
        };

        // Complete the starting item set and use it to generate the rest
        const startingItem = new ParserItem(this.grammar.startProductionRule, 0, 0);
        const startingSet = this.getClosures([startingItem]);
        itemSets.push(startingSet);
        generate(startingSet, 0);

        const terminals = this.grammar.tokenRules.map(rule => rule.type);
        const nonTerminals = Object.keys(this.grammar.productionRules);

        // Where t is terminals or nonTerminals
        const setup = t => () => t.reduce((o, k) => {
            o[k] = [];
            return o;
        }, {});

        // Each table is of the form (Object<Symbol, Action[]>)[]
        // "Symbol" is a string representing a terminal or a non terminal
        // For the actionTable, Action is { shift: number } (shift to state),
        // { run: Function, lhs: string, length: number } (reduce), { accept: boolean } (accept), or null (error)
        // For the gotoTable, Action is { state: number }, or null (error)
        // Each Symbol is keyed to an array so that conflicts are allowed for planned GLR parsing
        const actionTable = Array.from({ length: itemSets.length }, setup(terminals));
        const gotoTable = Array.from({ length: itemSets.length }, setup(nonTerminals));

        for (const transition of transitions) {
            const rule = this.grammar.productionRules[transition.symbol];
            const table = rule ? gotoTable : actionTable;

            // Transfer of terminals to action table as shift action; non-terminals to goto table
            table[transition.origin][transition.symbol].push({
                [rule ? 'state' : 'shift']: transition.end
            });
        }

        for (let i = 0; i < itemSets.length; i++) {
            const itemSet = itemSets[i];
            for (const item of itemSet) {
                if (item.path.slice(-1)[0] === this.grammar.eofTokenRule.type && item.dotIndex === item.path.length - 1) {
                    // Create the accept action for dot at EOF
                    actionTable[i][this.grammar.eofTokenRule.type].push({ accept: true });
                }

                if (i > 0 && item.dotIndex === item.path.length) {
                    // Create the reduce action for dot at end
                    // Algorithm LR(0) so all symbols are given the action
                    // LR(1) parsing is planned
                    for (const key of Object.keys(actionTable[i])) {
                        const amount = actionTable[i][key].push({
                            reduce: {
                                run: item.rule.paths[item.pathIndex].do || defaultAction,
                                lhs: item.rule.name,
                                length: item.rule.paths[item.pathIndex].is.length
                            }
                        });

                        if (amount === 1) continue;
                        if (actionTable[i][key][0].shift !== undefined) {
                            // SR conflict
                            if (!this.grammar.suppressWarnings) {
                                // eslint-disable-next-line no-console
                                console.log(`Shift-reduce conflict at state ${i} token ${key}`);
                            }
                        } else if (actionTable[i][key][0].reduce !== undefined) {
                            // RR conflict
                            if (!this.grammar.suppressWarnings) {
                                // eslint-disable-next-line no-console
                                console.log(`Reduce-reduce conflict at state ${i} token ${key}`);
                            }
                        }
                    }
                }
            }
        }

        return { action: actionTable, goto: gotoTable };
    }

    parse(inputText) {
        const lexer = new Lexer(inputText, this.grammar.tokenRules);
        const parserPath = new ParserPath(this, lexer);
        return parserPath.run();
    }
}

class ParserItem {
    constructor(rule, pathIndex, dotIndex) {
        this.rule = rule;
        this.pathIndex = pathIndex;
        this.dotIndex = dotIndex;
    }

    get origin() {
        return this.rule.name;
    }

    get path() {
        return this.rule.paths[this.pathIndex].is;
    }

    get symbol() {
        return this.path[this.dotIndex];
    }

    move() {
        return new ParserItem(this.rule, this.pathIndex, this.dotIndex + 1);
    }

    equals(item) {
        return this.rule === item.rule
            && this.pathIndex === item.pathIndex
            && this.dotIndex === item.dotIndex;
    }

    [util.inspect.custom]() {
        const path = this.path.slice(0);
        path.splice(this.dotIndex, 0, '.');
        return `{ ${this.origin} -> ${path.join(' ')} }`;
    }
}

class ParserTransition {
    constructor(origin, end, symbol) {
        this.origin = origin;
        this.end = end;
        this.symbol = symbol;
    }

    [util.inspect.custom]() {
        return `${this.origin} [${this.symbol}] -> ${this.end}`;
    }
}

module.exports = Parser;
