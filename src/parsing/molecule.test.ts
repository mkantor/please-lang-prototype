import assert from 'node:assert'
import test from 'node:test'
import * as option from '../adts/option.js'
import { type Option } from '../adts/option.js'
import * as molecule from './molecule.js'
import { type Molecule } from './molecule.js'

const cases: readonly (readonly [
  input: Molecule,
  expectedOutput: Option<Molecule>,
])[] = [
  [{ key: 'value' }, option.makeSome({ key: 'value' })],
  [{ '@@key': 'value' }, option.makeSome({ '@key': 'value' })],
  [{ key: '@@value' }, option.makeSome({ key: '@value' })],
  [{ '@@key': '@@value' }, option.makeSome({ '@key': '@value' })],
  [{ '@@key': '@value' }, option.none],
  [{ '@key': '@@value' }, option.none],
]

cases.forEach(([input, expectedOutput]) =>
  test(`transforming \`${JSON.stringify(
    input,
  )}\` produces expected output`, () =>
    assert.deepStrictEqual(
      molecule.applyEliminationRules(input),
      expectedOutput,
    )),
)
