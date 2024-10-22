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
  input: Molecule,
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
  [{ key: 'value' }, { key: 'value' }],
  [{ key: { key: 'value' } }, { key: { key: 'value' } }],
  [{ '@key': '@value' }, { '@key': '@value' }],
  [{ '@@key': '@@value' }, { '@@key': '@@value' }],
  [{ key: { 0: '@@escaped' } }, { key: { 0: '@escaped' } }],
  [{ 0: { 0: '@@escaped' } }, { 0: { 0: '@escaped' } }],
  [
    { key: { 0: '@someUnknownKeyword' } },
    output => assert(either.isLeft(output)),
  ],

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
