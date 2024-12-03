import assert from 'node:assert'
import { either, option, type Either } from '../../adts.js'
import { withPhantomData } from '../../phantom-data.js'
import { testCases } from '../../test-utilities.test.js'
import type { Writable } from '../../utility-types.js'
import type { ElaborationError } from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'
import {
  elaborate,
  isFunctionNode,
  makeObjectNode,
  type ElaboratedSemanticGraph,
  type ObjectNode,
} from '../semantics.js'
import type { SemanticGraph } from '../semantics/semantic-graph.js'
import * as keywordModule from './semantics/keywords.js'
import { prelude } from './semantics/prelude.js'

const elaborationSuite = testCases(
  (input: Atom | Molecule) =>
    elaborate(withPhantomData<never>()(input), keywordModule),
  input => `elaborating expressions in \`${JSON.stringify(input)}\``,
)

const literalMoleculeToObjectNode = (molecule: Molecule): ObjectNode => {
  const properties: Writable<Record<string, SemanticGraph>> = {}
  for (const [key, propertyValue] of Object.entries(molecule)) {
    properties[key] =
      typeof propertyValue === 'string'
        ? propertyValue
        : literalMoleculeToObjectNode(propertyValue)
  }
  return makeObjectNode(properties)
}

const success = (
  expectedOutput: Atom | Molecule,
): Either<ElaborationError, ElaboratedSemanticGraph> =>
  either.makeRight(
    withPhantomData<never>()(
      typeof expectedOutput === 'string'
        ? expectedOutput
        : literalMoleculeToObjectNode(expectedOutput),
    ),
  )

elaborationSuite('basic keyword syntax', [
  [{}, success({})],
  ['', success('')],
  [{ key: 'value' }, success({ key: 'value' })],
  [{ key: { key: 'value' } }, success({ key: { key: 'value' } })],
  [{ '@@key': '@@value' }, success({ '@key': '@value' })],
  [
    { '@@key': { nested: '@@value' } },
    success({ '@key': { nested: '@value' } }),
  ],
  [{ key: { 0: '@@escaped' } }, success({ key: { 0: '@escaped' } })],
  [{ 0: '@@escaped' }, success({ 0: '@escaped' })],
  [{ key: { 1: '@@escaped' } }, success({ key: { 1: '@escaped' } })],
  ['@@escaped', success('@escaped')],
  [{ 0: { 0: '@@escaped' } }, success({ 0: { 0: '@escaped' } })],
  [
    { key: { 0: '@someUnknownKeyword' } },
    output => assert(either.isLeft(output)),
  ],
  [{ '@someUnknownKeyword': 'value' }, output => assert(either.isLeft(output))],
  [{ key: '@someUnknownKeyword' }, output => assert(either.isLeft(output))],
  [{ '@todo': 'value' }, output => assert(either.isLeft(output))],
  [{ key: '@todo' }, output => assert(either.isLeft(output))],
  [
    { 0: '@todo this is also not valid' },
    output => assert(either.isLeft(output)),
  ],
])

elaborationSuite('@todo', [
  [{ 0: '@todo', 1: 'blah' }, success({})],
  [{ 0: '@todo', 1: { 0: '@@blah' } }, success({})],
  [
    {
      key1: { 0: '@todo', 1: 'this should be replaced with an empty object' },
      key2: { 0: '@todo' },
    },
    success({ key1: {}, key2: {} }),
  ],
])

elaborationSuite('@check', [
  [{ 0: '@check', 1: 'a', 2: 'a' }, success('a')],
  [{ 0: '@check', type: 'a', value: 'a' }, success('a')],
  [{ 0: '@check', type: '', value: '' }, success('')],
  [{ 0: '@check', type: '@@a', value: '@@a' }, success('@a')],
  [{ 0: '@check', 1: 'a', 2: 'B' }, output => assert(either.isLeft(output))],
  [
    { 0: '@check', type: 'a', value: 'B' },
    output => assert(either.isLeft(output)),
  ],
  [
    { 0: '@check', type: 'a', value: {} },
    output => assert(either.isLeft(output)),
  ],
  [
    { 0: '@check', type: {}, value: 'a' },
    output => assert(either.isLeft(output)),
  ],
  [
    {
      0: '@check',
      type: { a: 'b' },
      value: { a: 'not b' },
    },
    output => assert(either.isLeft(output)),
  ],
  [
    {
      0: '@check',
      type: { something: { more: 'complicated' } },
      value: { something: { more: 'complicated' } },
    },
    success({ something: { more: 'complicated' } }),
  ],
  [
    {
      0: '@check',
      type: { something: { more: 'complicated' } },
      value: {
        something: { more: 'complicated, which also does not typecheck' },
      },
    },
    output => assert(either.isLeft(output)),
  ],
  [
    {
      0: '@check',
      type: { a: 'b' },
      value: {},
    },
    output => assert(either.isLeft(output)),
  ],
  [
    {
      0: '@check',
      type: { a: { b: 'c' } },
      value: { a: {} },
    },
    output => assert(either.isLeft(output)),
  ],
  // values with excess properties:
  [
    {
      0: '@check',
      type: { a: 'b' },
      value: { a: 'b', c: 'd' },
    },
    success({ a: 'b', c: 'd' }),
  ],
  [
    {
      0: '@check',
      type: {},
      value: { a: 'b' },
    },
    success({ a: 'b' }),
  ],
  [
    {
      0: '@check',
      type: { a: {} },
      value: { a: { b: 'c' } },
    },
    success({ a: { b: 'c' } }),
  ],
])

elaborationSuite('@lookup', [
  [
    {
      foo: 'bar',
      bar: { 0: '@lookup', 1: { 0: 'foo' } },
    },
    success({ foo: 'bar', bar: 'bar' }),
  ],
  [
    {
      foo: 'bar',
      bar: { 0: '@lookup', query: { 0: 'foo' } },
    },
    success({ foo: 'bar', bar: 'bar' }),
  ],
  [
    {
      foo: 'bar',
      bar: { 0: '@lookup', 1: 'foo' },
    },
    success({ foo: 'bar', bar: 'bar' }),
  ],
  [
    {
      a: 'A',
      b: {
        a: 'different A',
        b: { 0: '@lookup', query: { 0: 'a' } },
      },
    },
    success({
      a: 'A',
      b: {
        a: 'different A',
        b: 'different A',
      },
    }),
  ],
  [
    {
      a: 'A',
      b: {
        a: { nested: 'nested A' },
        b: { 0: '@lookup', query: { 0: 'a', 1: 'nested' } },
      },
    },
    success({
      a: 'A',
      b: {
        a: { nested: 'nested A' },
        b: 'nested A',
      },
    }),
  ],
  [
    {
      foo: 'bar',
      bar: { 0: '@lookup', 1: { 0: 'foo' } },
      baz: { 0: '@lookup', 1: { 0: 'bar' } },
    },
    success({ foo: 'bar', bar: 'bar', baz: 'bar' }),
  ],
  [
    { a: { 0: '@lookup', _: 'missing query' } },
    output => assert(either.isLeft(output)),
  ],
  [
    { a: { 0: '@lookup', query: 'not a valid selector' } },
    output => assert(either.isLeft(output)),
  ],
  [
    { a: { 0: '@lookup', query: { 0: 'thisPropertyDoesNotExist' } } },
    output => assert(either.isLeft(output)),
  ],

  // lexical scoping
  [
    {
      a: { b: 'C' },
      b: {
        c: { 0: '@lookup', query: { 0: 'a', 1: 'b' } },
      },
    },
    success({
      a: { b: 'C' },
      b: {
        c: 'C',
      },
    }),
  ],
  [
    {
      a: { b: 'C' },
      b: {
        a: {}, // this `a` should be referenced
        c: { 0: '@lookup', query: { 0: 'a', 1: 'b' } },
      },
    },
    output => assert(either.isLeft(output)),
  ],
])

elaborationSuite('@apply', [
  [
    { 0: '@apply', 1: { 0: '@lookup', query: { 0: 'identity' } }, 2: 'a' },
    success('a'),
  ],
  [
    {
      0: '@apply',
      function: { 0: '@lookup', query: { 0: 'identity' } },
      argument: 'a',
    },
    success('a'),
  ],
  [
    {
      0: '@apply',
      function: { 0: '@lookup', query: { 0: 'identity' } },
      argument: { foo: 'bar' },
    },
    success({ foo: 'bar' }),
  ],
  [
    { 0: '@apply', function: 'not a function', argument: 'a' },
    output => assert(either.isLeft(output)),
  ],
  [
    {
      0: '@apply',
      function: { 0: '@function', 1: 'x', 2: { 0: '@lookup', 1: 'x' } },
      argument: 'identity is identical',
    },
    success('identity is identical'),
  ],
  [
    {
      0: '@apply',
      function: {
        0: '@function',
        parameter: 'a',
        body: {
          0: '@apply',
          function: {
            0: '@function',
            parameter: 'b',
            body: {
              A: { 0: '@lookup', query: 'a' },
              B: { 0: '@lookup', query: 'b' },
            },
          },
          argument: 'b',
        },
      },
      argument: 'a',
    },
    success({ A: 'a', B: 'b' }),
  ],
  [
    {
      0: '@apply',
      function: {
        0: '@function',
        1: 'x',
        2: {
          0: '@apply',
          function: { 0: '@lookup', 1: { 0: 'boolean', 1: 'not' } },
          argument: { 0: '@lookup', 1: 'x' },
        },
      },
      argument: 'false',
    },
    success('true'),
  ],
  [
    {
      0: '@apply',
      function: {
        0: '@function',
        1: 'x',
        2: { 0: '@lookup', 1: { 0: 'x', 1: 'a' } },
      },
      argument: { a: 'it works' },
    },
    success('it works'),
  ],
  [
    // {
    //   a: "a"
    //   b: (a => {
    //     a: "b"
    //     b: (a => :a)("it works")
    //   })("unused")
    // }
    {
      a: 'a',
      b: {
        0: '@apply',
        function: {
          0: '@function',
          parameter: 'a',
          body: {
            a: 'b',
            b: {
              0: '@apply',
              function: {
                0: '@function',
                parameter: 'a',
                body: {
                  0: '@lookup',
                  query: 'a',
                },
              },
              argument: 'it works',
            },
          },
        },
        argument: 'unused',
      },
    },
    success({
      a: 'a',
      b: {
        a: 'b',
        b: 'it works',
      },
    }),
  ],
  [
    // {
    //   a: "a"
    //   b: (a => {
    //     a: "it works"
    //     b: (a => :a)(:a)
    //   })("unused")
    // }
    {
      a: 'a',
      b: {
        0: '@apply',
        function: {
          0: '@function',
          parameter: 'a',
          body: {
            a: 'it works',
            b: {
              0: '@apply',
              function: {
                0: '@function',
                parameter: 'a',
                body: { 0: '@lookup', query: 'a' },
              },
              argument: { 0: '@lookup', query: 'a' },
            },
          },
        },
        argument: 'unused',
      },
    },
    success({
      a: 'a',
      b: {
        a: 'it works',
        b: 'it works',
      },
    }),
  ],
  [
    // {
    //   a:"it works"
    //   b: (a => {
    //     b: (a => :a)(:a)
    //   })(:a)
    // }
    {
      a: 'it works',
      b: {
        0: '@apply',
        function: {
          0: '@function',
          parameter: 'a',
          body: {
            b: {
              0: '@apply',
              function: {
                0: '@function',
                parameter: 'a',
                body: { 0: '@lookup', query: 'a' },
              },
              argument: { 0: '@lookup', query: 'a' },
            },
          },
        },
        argument: { 0: '@lookup', query: 'a' },
      },
    },
    success({
      a: 'it works',
      b: {
        b: 'it works',
      },
    }),
  ],
  [
    // {
    //   a: "a"
    //   b: (a => {
    //     a: "it works"
    //     b: (b => :a)("unused")
    //   })("unused")
    // }
    {
      a: 'a',
      b: {
        0: '@apply',
        function: {
          0: '@function',
          parameter: 'a',
          body: {
            a: 'it works',
            b: {
              0: '@apply',
              function: {
                0: '@function',
                parameter: 'b',
                body: { 0: '@lookup', query: 'a' },
              },
              argument: 'unused',
            },
          },
        },
        argument: 'unused',
      },
    },
    success({
      a: 'a',
      b: {
        a: 'it works',
        b: 'it works',
      },
    }),
  ],
  [
    // {
    //   a: "it works"
    //   b: (b => {
    //     b: "b"
    //     c: (b => :a)("unused")
    //   })("unused")
    // }
    {
      a: 'it works',
      b: {
        0: '@apply',
        function: {
          0: '@function',
          parameter: 'b',
          body: {
            b: 'b',
            c: {
              0: '@apply',
              function: {
                0: '@function',
                parameter: 'b',
                body: { 0: '@lookup', query: 'a' },
              },
              argument: 'unused',
            },
          },
        },
        argument: 'unused',
      },
    },
    success({
      a: 'it works',
      b: {
        b: 'b',
        c: 'it works',
      },
    }),
  ],
])

elaborationSuite('@function', [
  [
    { 0: '@function', 1: 'not a function' },
    output => assert(either.isLeft(output)),
  ],
  [
    { 0: '@function', 1: 'x', 2: { 0: '@lookup', 1: 'x' } },
    elaboratedFunction => {
      assert(!either.isLeft(elaboratedFunction))
      assert(isFunctionNode(elaboratedFunction.value))
      assert.deepEqual(
        elaboratedFunction.value.parameterName,
        option.makeSome('x'),
      )
      assert.deepEqual(
        elaboratedFunction.value.serialize(),
        either.makeRight({
          0: '@function',
          parameter: 'x',
          body: { 0: '@lookup', 1: { 0: 'x' } },
        }),
      )
    },
  ],
])

elaborationSuite('@runtime', [
  [
    { 0: '@runtime', 1: { 0: '@lookup', query: { 0: 'identity' } } },
    either.makeRight(
      withPhantomData<never>()(
        makeObjectNode({ 0: '@runtime', 1: prelude.identity! }),
      ),
    ),
  ],
  [
    { 0: '@runtime', 1: 'not a function' },
    output => assert(either.isLeft(output)),
  ],
])
