import assert from 'node:assert'
import test from 'node:test'
import type { Either } from '../adts/either.js'
import * as either from '../adts/either.js'
import type { Option } from '../adts/option.js'
import * as option from '../adts/option.js'
import type { CompilationError } from './errors.js'
import * as keywordApplication from './keyword-application.js'
import type { UncompiledMolecule } from './molecule.js'

const expectedOutput = (molecule: UncompiledMolecule) =>
  either.makeRight(option.makeSome(molecule))

const cases: readonly (readonly [
  input: UncompiledMolecule,
  check:
    | UncompiledMolecule
    | ((
        output: Either<
          CompilationError,
          Option<keywordApplication.CompiledMolecule>
        >,
      ) => void),
])[] = [
  // basic keyword syntax and escaping:
  [{ key: 'value' }, { key: 'value' }],
  [{ '@@key': 'value' }, { '@key': 'value' }],
  [{ key: '@@value' }, { key: '@value' }],
  [{ '@@key': '@@value' }, { '@key': '@value' }],
  [{ '@@key': '@someUnknownKeyword' }, output => assert(either.isLeft(output))],
  [
    { '@someUnknownKeyword': '@@value' },
    output => assert(either.isLeft(output)),
  ],

  // @todo keyword:
  [{ '@todo': 'value' }, {}],
  [{ '@todo': '@@value' }, {}],
  [{ '@todo some arbitrary characters!': 'value' }, {}],
  [{ '@todoeventhisshouldwork': 'value' }, {}],
  [
    {
      key1: '@todo this should be replaced with an empty string',
      key2: '@todothistoo',
      '@todoKey3': '@todo and this property should be eliminated entirely',
    },
    { key1: '', key2: '' },
  ],

  // nesting/recursion:
  [{ key: { key: 'value' } }, { key: { key: 'value' } }],
  [{ key: { '@@key': '@@value' } }, { key: { '@key': '@value' } }],
  [{ key: { '@todo': 'value' } }, { key: {} }],
]

cases.forEach(([input, check]) =>
  test(`transforming \`${JSON.stringify(
    input,
  )}\` produces expected output`, () => {
    const output = keywordApplication.applyKeywords(input)
    if (typeof check === 'function') {
      check(output)
    } else {
      assert.deepEqual(output, expectedOutput(check))
    }
  }),
)
