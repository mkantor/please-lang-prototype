import assert from 'node:assert'
import test from 'node:test'
import type { InputMolecule, Molecule } from './molecule.js'
import * as molecule from './molecule.js'

const cases: readonly (readonly [
  input: InputMolecule,
  expectedOutput: Molecule,
])[] = [
  [{}, {}],
  [[], {}],
  [['a'], { 0: 'a' }],
  [{ 0: 'a' }, { 0: 'a' }],
  [{ 1: 'a' }, { 1: 'a' }],
  [
    ['a', { b: [], c: { d: ['e', {}] } }, 'f'],
    { 0: 'a', 1: { b: {}, c: { d: { 0: 'e', 1: {} } } }, 2: 'f' },
  ],
]

cases.forEach(([input, expectedOutput]) =>
  test(`canonicalizing \`${JSON.stringify(
    input,
  )}\` produces expected output`, () => {
    const output = molecule.canonicalizeMolecule(input)
    assert.deepEqual(output, expectedOutput)
  }),
)
