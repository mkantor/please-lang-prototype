import assert from 'node:assert'
import { either, type Either } from '../../adts.js'
import { withPhantomData } from '../../phantom-data.js'
import { testCases } from '../../test-utilities.test.js'
import type { Writable } from '../../utility-types.js'
import type { ElaborationError } from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'
import {
  elaborate,
  makeObjectNode,
  makePartiallyElaboratedObjectNode,
  type ElaboratedValue,
  type ObjectNode,
} from '../semantics.js'
import * as keywordModule from './semantics/keywords.js'
import { prelude } from './semantics/prelude.js'

const elaborationSuite = testCases(
  (input: Atom | Molecule) =>
    elaborate(withPhantomData<never>()(input), keywordModule),
  input => `elaborating expressions in \`${JSON.stringify(input)}\``,
)

const literalMoleculeToObjectNode = (molecule: Molecule): ObjectNode => {
  const children: Writable<ObjectNode['children']> = {}
  for (const [key, propertyValue] of Object.entries(molecule)) {
    children[key] =
      typeof propertyValue === 'string'
        ? propertyValue
        : literalMoleculeToObjectNode(propertyValue)
  }
  return makeObjectNode(children)
}

const success = (
  expectedOutput: Atom | Molecule,
): Either<ElaborationError, ElaboratedValue> =>
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
])

elaborationSuite('@runtime', [
  [
    { 0: '@runtime', 1: { 0: '@lookup', query: { 0: 'identity' } } },
    elaboratedValue => {
      if (prelude.children.identity === undefined) {
        throw new Error('Prelude does not contain `identity`. This is a bug!')
      }
      const expectedValue = either.makeRight(
        makePartiallyElaboratedObjectNode({
          0: '@runtime',
          1: prelude.children.identity,
        }),
      )
      assert.deepEqual(elaboratedValue, expectedValue)
    },
  ],
  [
    { 0: '@runtime', 1: 'not a function' },
    output => assert(either.isLeft(output)),
  ],
])
