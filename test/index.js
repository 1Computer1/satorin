const { Grammar, Parser } = require('..');
const grammar = new Grammar()
    .setTokens({
        WS: {
            match: /\s+/,
            ignore: true
        },
        '+': '+',
        '*': '*',
        NUMBER: /\d+/,
        EOF: { eof: true }
    })
    .setRules({
        Start: [
            {
                is: ['Expression', 'EOF']
            }
        ],
        Expression: [
            {
                is: ['Expression', '+', 'Term'],
                do: $ => $[0] + $[2]
            },
            {
                is: ['Expression', '*', 'Term'],
                do: $ => $[0] + $[2]
            },
            {
                is: ['Term']
            }
        ],
        Term: [
            {
                is: ['NUMBER'],
                do: $ => Number($[0].value)
            }
        ]
    });

const parser = new Parser(grammar);
console.log(parser.parse('1 + 2 + 3'));
