import assert from 'node:assert'
import test from 'node:test'
import type { Atom } from './atom.js'
import type { Molecule } from './molecule.js'
import * as molecule from './molecule.js'

const cases = [
  [{}, {}],
  [[], {}],
  ['a', 'a'],
  [1, '1'],
  [Number.EPSILON, '2.220446049250313e-16'],
  [null, 'null'],
  [true, 'true'],
  [false, 'false'],
  [['a'], { 0: 'a' }],
  [{ 0: 'a' }, { 0: 'a' }],
  [{ 1: 'a' }, { 1: 'a' }],
  [
    ['a', { b: [], c: { d: ['e', {}, 42] } }, 'f', { g: null }, true],
    {
      0: 'a',
      1: { b: {}, c: { d: { 0: 'e', 1: {}, 2: '42' } } },
      2: 'f',
      3: { g: 'null' },
      4: 'true',
    },
  ],
] satisfies readonly (readonly [
  input: unknown,
  expectedOutput: Atom | Molecule,
])[]

cases.forEach(([input, expectedOutput]) =>
  test(`canonicalizing \`${JSON.stringify(
    input,
  )}\` produces expected output`, () => {
    const output = molecule.canonicalize(input)
    assert.deepEqual(output, expectedOutput)
  }),
)
