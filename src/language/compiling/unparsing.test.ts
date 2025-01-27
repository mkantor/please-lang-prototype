import either from '@matt.kantor/either'
import stripAnsi from 'strip-ansi'
import { testCases } from '../../test-utilities.test.js'
import { type Atom, type Molecule } from '../parsing.js'
import {
  inlinePlz,
  prettyJson,
  prettyPlz,
  type Notation,
} from '../unparsing.js'

const unparser = (notation: Notation) => (value: Atom | Molecule) =>
  either.map(
    typeof value === 'string'
      ? notation.atom(value)
      : notation.molecule(value, notation),
    stripAnsi, // terminal styling is not currently tested
  )

testCases(
  unparser(inlinePlz),
  input => `unparsing \`${JSON.stringify(input)}\``,
)('inline plz', [
  [{}, either.makeRight('{}')],
  ['a', either.makeRight('a')],
  ['Hello, world!', either.makeRight('"Hello, world!"')],
  [{ 0: 'a' }, either.makeRight('{ a }')],
  [{ 1: 'a' }, either.makeRight('{ 1: a }')],
  [
    { 0: 'a', 1: 'b', 3: 'c', somethingElse: 'd' },
    either.makeRight('{ a, b, 3: c, somethingElse: d }'),
  ],
  [{ a: { b: { c: 'd' } } }, either.makeRight('{ a: { b: { c: d } } }')],
  [
    {
      identity: {
        0: '@function',
        parameter: 'a',
        body: { 0: '@lookup', 1: 'a' },
      },
      test: {
        0: '@apply',
        function: { 0: '@lookup', 1: 'identity' },
        argument: 'it works!',
      },
    },
    either.makeRight('{ identity: a => :a, test: :identity("it works!") }'),
  ],
  [
    {
      0: '@apply',
      function: {
        0: '@function',
        parameter: 'a',
        body: { 0: '@lookup', 1: 'a' },
      },
      argument: 'it works!',
    },
    either.makeRight('(a => :a)("it works!")'),
  ],
])

testCases(
  unparser(prettyPlz),
  input => `unparsing \`${JSON.stringify(input)}\``,
)('pretty plz', [
  [{}, either.makeRight('{}')],
  ['a', either.makeRight('a')],
  ['Hello, world!', either.makeRight('"Hello, world!"')],
  [{ 0: 'a' }, either.makeRight('{\n  a\n}')],
  [{ 1: 'a' }, either.makeRight('{\n  1: a\n}')],
  [
    { 0: 'a', 1: 'b', 3: 'c', somethingElse: 'd' },
    either.makeRight('{\n  a\n  b\n  3: c\n  somethingElse: d\n}'),
  ],
  [
    { a: { b: { c: 'd' } } },
    either.makeRight('{\n  a: {\n    b: {\n      c: d\n    }\n  }\n}'),
  ],
  [
    {
      identity: {
        0: '@function',
        parameter: 'a',
        body: { 0: '@lookup', 1: 'a' },
      },
      test: {
        0: '@apply',
        function: { 0: '@lookup', 1: 'identity' },
        argument: 'it works!',
      },
    },
    either.makeRight(
      '{\n  identity: a => :a\n  test: :identity("it works!")\n}',
    ),
  ],
  [
    {
      0: '@apply',
      function: {
        0: '@function',
        parameter: 'a',
        body: { 0: '@lookup', 1: 'a' },
      },
      argument: 'it works!',
    },
    either.makeRight('(a => :a)("it works!")'),
  ],
])

testCases(
  unparser(prettyJson),
  input => `unparsing \`${JSON.stringify(input)}\``,
)('pretty JSON', [
  [{}, either.makeRight('{}')],
  ['a', either.makeRight('"a"')],
  ['Hello, world!', either.makeRight('"Hello, world!"')],
  [{ 0: 'a' }, either.makeRight('{\n  "0": "a"\n}')],
  [{ 1: 'a' }, either.makeRight('{\n  "1": "a"\n}')],
  [
    { 0: 'a', 1: 'b', 3: 'c', somethingElse: 'd' },
    either.makeRight(
      '{\n  "0": "a",\n  "1": "b",\n  "3": "c",\n  "somethingElse": "d"\n}',
    ),
  ],
  [
    { a: { b: { c: 'd' } } },
    either.makeRight('{\n  "a": {\n    "b": {\n      "c": "d"\n    }\n  }\n}'),
  ],
  [
    {
      identity: {
        0: '@function',
        parameter: 'a',
        body: { 0: '@lookup', 1: 'a' },
      },
      test: {
        0: '@apply',
        function: { 0: '@lookup', 1: 'identity' },
        argument: 'it works!',
      },
    },
    either.makeRight(
      '{\n  "identity": {\n    "0": "@function",\n    "parameter": "a",\n    "body": {\n      "0": "@lookup",\n      "1": "a"\n    }\n  },\n  "test": {\n    "0": "@apply",\n    "function": {\n      "0": "@lookup",\n      "1": "identity"\n    },\n    "argument": "it works!"\n  }\n}',
    ),
  ],
  [
    {
      0: '@apply',
      function: {
        0: '@function',
        parameter: 'a',
        body: { 0: '@lookup', 1: 'a' },
      },
      argument: 'it works!',
    },
    either.makeRight(
      '{\n  "0": "@apply",\n  "function": {\n    "0": "@function",\n    "parameter": "a",\n    "body": {\n      "0": "@lookup",\n      "1": "a"\n    }\n  },\n  "argument": "it works!"\n}',
    ),
  ],
])
