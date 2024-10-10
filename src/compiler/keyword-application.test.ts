import assert from 'node:assert'
import test from 'node:test'
import type { Either } from '../adts/either.js'
import * as either from '../adts/either.js'
import * as option from '../adts/option.js'
import { type Option } from '../adts/option.js'
import { type CompilationError } from './errors.js'
import * as keywordApplication from './keyword-application.js'
import { type Molecule } from './molecule.js'

const expectedOutput = (molecule: Molecule) =>
  either.makeRight(option.makeSome(molecule))

const cases: readonly (readonly [
  input: Molecule,
  check: (output: Either<CompilationError, Option<Molecule>>) => void,
])[] = [
  // basic keyword syntax and escaping:
  [
    { key: 'value' },
    output => assert.deepEqual(output, expectedOutput({ key: 'value' })),
  ],
  [
    { '@@key': 'value' },
    output => assert.deepEqual(output, expectedOutput({ '@key': 'value' })),
  ],
  [
    { key: '@@value' },
    output => assert.deepEqual(output, expectedOutput({ key: '@value' })),
  ],
  [
    { '@@key': '@@value' },
    output => assert.deepEqual(output, expectedOutput({ '@key': '@value' })),
  ],
  [{ '@@key': '@someUnknownKeyword' }, output => assert(either.isLeft(output))],
  [
    { '@someUnknownKeyword': '@@value' },
    output => assert(either.isLeft(output)),
  ],

  // @todo keyword:
  [
    { '@todo': 'value' },
    output => assert.deepEqual(output, expectedOutput({})),
  ],
  [
    { '@todo': '@@value' },
    output => assert.deepEqual(output, expectedOutput({})),
  ],
  [
    { '@todo some arbitrary characters!': 'value' },
    output => assert.deepEqual(output, expectedOutput({})),
  ],
  [
    { '@todoeventhisshouldwork': 'value' },
    output => assert.deepEqual(output, expectedOutput({})),
  ],
  [
    {
      key1: '@todo this should be replaced with an empty string',
      key2: '@todothistoo',
      '@todoKey3': '@todo and this property should be eliminated entirely',
    },
    output => assert.deepEqual(output, expectedOutput({ key1: '', key2: '' })),
  ],

  // nesting/recursion:
  [
    { key: { key: 'value' } },
    output =>
      assert.deepEqual(output, expectedOutput({ key: { key: 'value' } })),
  ],
  [
    { key: { '@@key': '@@value' } },
    output =>
      assert.deepEqual(output, expectedOutput({ key: { '@key': '@value' } })),
  ],
  [
    { key: { '@todo': 'value' } },
    output => assert.deepEqual(output, expectedOutput({ key: {} })),
  ],
]

cases.forEach(([input, check]) =>
  test(`transforming \`${JSON.stringify(
    input,
  )}\` produces expected output`, () =>
    check(keywordApplication.applyKeywords(input))),
)
