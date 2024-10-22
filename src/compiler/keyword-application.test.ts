import assert from 'node:assert'
import test from 'node:test'
import type { Either } from '../adts/either.js'
import * as either from '../adts/either.js'
import { withPhantomData } from '../phantom-data.js'
import type { Atom } from './atom.js'
import type { CompilationError } from './errors.js'
import * as keywordApplication from './keyword-application.js'
import type { Molecule } from './molecule.js'
import type { Canonicalized } from './stages.js'

const cases: readonly (readonly [
  input: Atom | Molecule,
  check:
    | Atom
    | Molecule
    | ((
        output: Either<
          CompilationError,
          keywordApplication.CompiledAtom | keywordApplication.CompiledMolecule
        >,
      ) => void),
])[] = [
  // basic keyword syntax and escaping:
  [{}, {}],
  ['', ''],
  [{ key: 'value' }, { key: 'value' }],
  [{ key: { key: 'value' } }, { key: { key: 'value' } }],
  [{ '@@key': '@@value' }, { '@key': '@value' }],
  [{ key: { 0: '@@escaped' } }, { key: { 0: '@escaped' } }],
  [{ 0: '@@escaped' }, { 0: '@escaped' }],
  [{ key: { 1: '@@escaped' } }, { key: { 1: '@escaped' } }],
  ['@@escaped', '@escaped'],
  [{ 0: { 0: '@@escaped' } }, { 0: { 0: '@escaped' } }],
  [
    { key: { 0: '@someUnknownKeyword' } },
    output => assert(either.isLeft(output)),
  ],
  [{ '@someUnknownKeyword': 'value' }, output => assert(either.isLeft(output))],
  [{ key: '@someUnknownKeyword' }, output => assert(either.isLeft(output))],
  [{ '@todo': 'value' }, output => assert(either.isLeft(output))],
  [{ key: '@todo' }, output => assert(either.isLeft(output))],

  // @todo keyword:
  [{ 0: '@todo', 1: 'blah' }, {}],
  [{ 0: '@todo', 1: { 0: '@@blah' } }, {}],
  [
    {
      key1: { 0: '@todo', 1: 'this should be replaced with an empty object' },
      key2: { 0: '@todo' },
    },
    { key1: {}, key2: {} },
  ],

  // @check keyword:
  [{ 0: '@check', 1: 'a', 2: 'a' }, 'a'],
  [{ 0: '@check', type: 'a', value: 'a' }, 'a'],
  [{ 0: '@check', type: '', value: '' }, ''],
  [{ 0: '@check', type: '@@a', value: '@@a' }, '@a'],
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
    { something: { more: 'complicated' } },
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
    { a: 'b', c: 'd' },
  ],
  [
    {
      0: '@check',
      type: {},
      value: { a: 'b' },
    },
    { a: 'b' },
  ],
  [
    {
      0: '@check',
      type: { a: {} },
      value: { a: { b: 'c' } },
    },
    { a: { b: 'c' } },
  ],
]

cases.forEach(([input, check]) =>
  test(`applying keywords in \`${JSON.stringify(
    input,
  )}\` produces expected output`, () => {
    const output = keywordApplication.applyKeywords(
      withPhantomData<Canonicalized>()(input),
    )
    if (typeof check === 'function') {
      check(output)
    } else {
      assert.deepEqual(output, either.makeRight(check))
    }
  }),
)
