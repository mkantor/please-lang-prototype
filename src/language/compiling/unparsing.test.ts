import either from '@matt.kantor/either'
import assert from 'node:assert'
import stripAnsi from 'strip-ansi'
import { testCases } from '../../test-utilities.test.js'
import { type Atom, type Molecule } from '../parsing.js'
import {
  inlinePlz,
  prettyJson,
  prettyPlz,
  type Notation,
} from '../unparsing.js'

const unparsers = (value: Atom | Molecule) => {
  const unparse = (notation: Notation) =>
    either.map(
      typeof value === 'string'
        ? notation.atom(value)
        : notation.molecule(value, notation),
      stripAnsi, // terminal styling is not currently tested
    )

  const unparsedInlinePlz = unparse(inlinePlz)
  const unparsedPrettyPlz = unparse(prettyPlz)
  const unparsedPrettyJson = unparse(prettyJson)

  return {
    // TODO: Also test roundtrippableness of plz unparsing.
    inlinePlz: unparsedInlinePlz,
    prettyPlz: unparsedPrettyPlz,
    prettyJson: either.map(unparsedPrettyJson, json => {
      assert.deepEqual(JSON.parse(json), value)
      return json
    }),
  }
}

const outputs = (
  notations: Record<'inlinePlz' | 'prettyPlz' | 'prettyJson', string>,
) => ({
  inlinePlz: either.makeRight(notations.inlinePlz),
  prettyPlz: either.makeRight(notations.prettyPlz),
  prettyJson: either.makeRight(notations.prettyJson),
})

testCases(unparsers, input => `unparsing \`${JSON.stringify(input)}\``)(
  'unparsing',
  [
    [{}, outputs({ inlinePlz: '{}', prettyPlz: '{}', prettyJson: '{}' })],
    ['a', outputs({ inlinePlz: 'a', prettyPlz: 'a', prettyJson: '"a"' })],
    [
      'Hello, world!',
      outputs({
        inlinePlz: '"Hello, world!"',
        prettyPlz: '"Hello, world!"',
        prettyJson: '"Hello, world!"',
      }),
    ],
    [
      '@test',
      outputs({
        inlinePlz: '"@test"',
        prettyPlz: '"@test"',
        prettyJson: '"@test"',
      }),
    ],
    [
      { 0: 'a' },
      outputs({
        inlinePlz: '{ a }',
        prettyPlz: '{\n  a\n}',
        prettyJson: '{\n  "0": "a"\n}',
      }),
    ],
    [
      { 1: 'a' },
      outputs({
        inlinePlz: '{ 1: a }',
        prettyPlz: '{\n  1: a\n}',
        prettyJson: '{\n  "1": "a"\n}',
      }),
    ],
    [
      { 0: 'a', 1: 'b', 3: 'c', somethingElse: 'd' },
      outputs({
        inlinePlz: '{ a, b, 3: c, somethingElse: d }',
        prettyPlz: '{\n  a\n  b\n  3: c\n  somethingElse: d\n}',
        prettyJson:
          '{\n  "0": "a",\n  "1": "b",\n  "3": "c",\n  "somethingElse": "d"\n}',
      }),
    ],
    [
      { a: { b: { c: 'd' } } },
      outputs({
        inlinePlz: '{ a: { b: { c: d } } }',
        prettyPlz: '{\n  a: {\n    b: {\n      c: d\n    }\n  }\n}',
        prettyJson: '{\n  "a": {\n    "b": {\n      "c": "d"\n    }\n  }\n}',
      }),
    ],
    [
      {
        identity: {
          0: '@function',
          1: {
            parameter: 'a',
            body: { 0: '@lookup', 1: { 0: 'a' } },
          },
        },
        test: {
          0: '@apply',
          1: {
            function: { 0: '@lookup', 1: { 0: 'identity' } },
            argument: 'it works!',
          },
        },
      },
      outputs({
        inlinePlz: '{ identity: a => :a, test: :identity("it works!") }',
        prettyPlz: '{\n  identity: a => :a\n  test: :identity("it works!")\n}',
        prettyJson:
          '{\n  "identity": {\n    "0": "@function",\n    "1": {\n      "parameter": "a",\n      "body": {\n        "0": "@lookup",\n        "1": {\n          "0": "a"\n        }\n      }\n    }\n  },\n  "test": {\n    "0": "@apply",\n    "1": {\n      "function": {\n        "0": "@lookup",\n        "1": {\n          "0": "identity"\n        }\n      },\n      "argument": "it works!"\n    }\n  }\n}',
      }),
    ],
    [
      {
        0: '@apply',
        1: {
          function: {
            0: '@function',
            1: {
              parameter: 'a',
              body: { 0: '@lookup', 1: { 0: 'a' } },
            },
          },
          argument: 'it works!',
        },
      },
      outputs({
        inlinePlz: '(a => :a)("it works!")',
        prettyPlz: '(a => :a)("it works!")',
        prettyJson:
          '{\n  "0": "@apply",\n  "1": {\n    "function": {\n      "0": "@function",\n      "1": {\n        "parameter": "a",\n        "body": {\n          "0": "@lookup",\n          "1": {\n            "0": "a"\n          }\n        }\n      }\n    },\n    "argument": "it works!"\n  }\n}',
      }),
    ],
    [
      {
        0: '@runtime',
        1: {
          0: {
            0: '@function',
            1: {
              parameter: 'context',
              body: {
                0: '@index',
                1: {
                  object: { 0: '@lookup', 1: { key: 'context' } },
                  query: { 0: 'program', 1: 'start_time' },
                },
              },
            },
          },
        },
      },
      outputs({
        inlinePlz: '@runtime { context => :context.program.start_time }',
        prettyPlz: '@runtime {\n  context => :context.program.start_time\n}',
        prettyJson:
          '{\n  "0": "@runtime",\n  "1": {\n    "0": {\n      "0": "@function",\n      "1": {\n        "parameter": "context",\n        "body": {\n          "0": "@index",\n          "1": {\n            "object": {\n              "0": "@lookup",\n              "1": {\n                "key": "context"\n              }\n            },\n            "query": {\n              "0": "program",\n              "1": "start_time"\n            }\n          }\n        }\n      }\n    }\n  }\n}',
      }),
    ],
    [
      {
        'a.b': {
          'c "d"': {
            'e.f': 'g',
          },
        },
        test: {
          0: '@index',
          1: {
            object: { 0: '@lookup', 1: { 0: 'a.b' } },
            query: { 0: 'c "d"', 1: 'e.f' },
          },
        },
      },
      outputs({
        inlinePlz:
          '{ a.b: { "c \\"d"": { e.f: g } }, test: :"a.b"."c \\"d""."e.f" }',
        prettyPlz:
          '{\n  a.b: {\n    "c \\"d"": {\n      e.f: g\n    }\n  }\n  test: :"a.b"."c \\"d""."e.f"\n}',
        prettyJson:
          '{\n  "a.b": {\n    "c \\"d\\"": {\n      "e.f": "g"\n    }\n  },\n  "test": {\n    "0": "@index",\n    "1": {\n      "object": {\n        "0": "@lookup",\n        "1": {\n          "0": "a.b"\n        }\n      },\n      "query": {\n        "0": "c \\"d\\"",\n        "1": "e.f"\n      }\n    }\n  }\n}',
      }),
    ],
  ],
)
