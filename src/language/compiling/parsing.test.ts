import either from '@matt.kantor/either'
import assert from 'node:assert'
import { withPhantomData } from '../../phantom-data.js'
import { testCases } from '../../test-utilities.test.js'
import { canonicalize, type Atom, type Molecule } from '../parsing.js'
import { parse } from '../parsing/parser.js'

const syntaxTree = withPhantomData<never>()<Atom | Molecule>

testCases(parse, input => `parsing \`${input}\``)('parsing', [
  ['a', either.makeRight(syntaxTree('a'))],

  ['{}', either.makeRight(syntaxTree({}))],

  [
    ':a',
    either.makeRight(
      syntaxTree({
        '0': '@lookup',
        '1': { key: 'a' },
      }),
    ),
  ],

  [
    '{}.a',
    either.makeRight(
      syntaxTree({
        '0': '@index',
        '1': {
          object: {},
          query: { '0': 'a' },
        },
      }),
    ),
  ],

  [
    'a => b',
    either.makeRight(
      syntaxTree({
        '0': '@function',
        '1': {
          parameter: 'a',
          body: 'b',
        },
      }),
    ),
  ],
  [
    'a => b => c',
    either.makeRight(
      syntaxTree({
        '0': '@function',
        '1': {
          parameter: 'a',
          body: {
            '0': '@function',
            '1': {
              parameter: 'b',
              body: 'c',
            },
          },
        },
      }),
    ),
  ],

  [
    'a ~> b',
    either.makeRight(
      syntaxTree({
        '0': '@signature',
        '1': {
          parameter: 'a',
          return: 'b',
        },
      }),
    ),
  ],
  [
    'a ~> b ~> c',
    either.makeRight(
      syntaxTree({
        '0': '@signature',
        '1': {
          parameter: 'a',
          return: {
            '0': '@signature',
            '1': {
              parameter: 'b',
              return: 'c',
            },
          },
        },
      }),
    ),
  ],

  [
    '(a => a)(a)',
    either.makeRight(
      syntaxTree({
        0: '@apply',
        1: {
          argument: 'a',
          function: {
            '0': '@function',
            '1': {
              body: 'a',
              parameter: 'a',
            },
          },
        },
      }),
    ),
  ],

  [
    '1 + 1',
    either.makeRight(
      syntaxTree({
        0: '@apply',
        1: {
          argument: '1',
          function: {
            0: '@apply',
            1: {
              argument: '1',
              function: {
                '0': '@lookup',
                '1': { key: '+' },
              },
            },
          },
        },
      }),
    ),
  ],

  [
    'a | b',
    either.makeRight(
      syntaxTree({
        0: '@union',
        1: { 0: 'a', 1: 'b' },
      }),
    ),
  ],

  // `|`s in atoms must generally be quoted, with a few exceptions.
  ['|', result => assert(either.isLeft(result))],
  ['"|"', either.makeRight(syntaxTree('|'))],
  ['||', either.makeRight(syntaxTree('||'))],
  ['|>', either.makeRight(syntaxTree('|>'))],
  ['<|', either.makeRight(syntaxTree('<|'))],
  ['||invalid', result => assert(either.isLeft(result))],
  ['invalid||', result => assert(either.isLeft(result))],
  ['"||valid"', either.makeRight(syntaxTree('||valid'))],
  ['"valid||"', either.makeRight(syntaxTree('valid||'))],
])

testCases(canonicalize, input => `canonicalizing \`${JSON.stringify(input)}\``)(
  'canonicalization',
  [
    [{}, syntaxTree({})],
    [[], syntaxTree({})],
    ['a', syntaxTree('a')],
    [1, syntaxTree('1')],
    [Number.EPSILON, syntaxTree('2.220446049250313e-16')],
    [null, syntaxTree('null')],
    [true, syntaxTree('true')],
    [false, syntaxTree('false')],
    [['a'], syntaxTree({ 0: 'a' })],
    [{ 0: 'a' }, syntaxTree({ 0: 'a' })],
    [{ 1: 'a' }, syntaxTree({ 1: 'a' })],
    [
      ['a', { b: [], c: { d: ['e', {}, 42] } }, 'f', { g: null }, true],
      syntaxTree({
        0: 'a',
        1: { b: {}, c: { d: { 0: 'e', 1: {}, 2: '42' } } },
        2: 'f',
        3: { g: 'null' },
        4: 'true',
      }),
    ],
  ],
)
