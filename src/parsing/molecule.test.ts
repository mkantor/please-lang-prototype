import assert from 'node:assert'
import test from 'node:test'
import type { Either } from '../adts/either.js'
import * as either from '../adts/either.js'
import * as option from '../adts/option.js'
import { type Option } from '../adts/option.js'
import * as molecule from './molecule.js'
import { type Molecule } from './molecule.js'

const successfullyEliminatedMolecule = (molecule: Molecule) =>
  either.makeRight(option.makeSome(molecule))

const cases: readonly (readonly [
  input: Molecule,
  check: (output: Either<molecule.Error, Option<Molecule>>) => void,
])[] = [
  [
    { key: 'value' },
    output =>
      assert.deepEqual(
        output,
        successfullyEliminatedMolecule({ key: 'value' }),
      ),
  ],
  [
    { '@@key': 'value' },
    output =>
      assert.deepEqual(
        output,
        successfullyEliminatedMolecule({ '@key': 'value' }),
      ),
  ],
  [
    { key: '@@value' },
    output =>
      assert.deepEqual(
        output,
        successfullyEliminatedMolecule({ key: '@value' }),
      ),
  ],
  [
    { '@@key': '@@value' },
    output =>
      assert.deepEqual(
        output,
        successfullyEliminatedMolecule({ '@key': '@value' }),
      ),
  ],
  [{ '@@key': '@value' }, output => assert(either.isLeft(output))],
  [{ '@key': '@@value' }, output => assert(either.isLeft(output))],
]

cases.forEach(([input, check]) =>
  test(`transforming \`${JSON.stringify(
    input,
  )}\` produces expected output`, () =>
    check(molecule.applyEliminationRules(input))),
)
