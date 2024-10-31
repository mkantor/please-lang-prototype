import assert from 'node:assert'
import { either, type Either } from '../adts.js'
import type { ElaborationError } from '../errors.js'
import { type Atom, type Molecule } from '../parsing.js'
import { withPhantomData } from '../phantom-data.js'
import type { Output } from '../semantics.js'
import { testCases } from '../test-utilities.test.js'
import { evaluate } from './evaluator.js'

const success = (
  expectedOutput: Atom | Molecule,
): Either<ElaborationError, Output> =>
  either.makeRight(withPhantomData<never>()(expectedOutput))

testCases(evaluate, input => `evaluating \`${JSON.stringify(input)}\``)(
  'evaluator',
  [
    ['Hello, world!', success('Hello, world!')],
    [['@check', true, ['@lookup', ['identity']]], success('true')],
    [
      ['@runtime', ['@lookup', ['identity']]],
      output => {
        assert(!either.isLeft(output))
        assert(typeof output.value === 'object')
        assert(typeof output.value.environment === 'object')
      },
    ],
    [
      ['@check', 'not a boolean', ['@lookup', ['boolean', 'is']]],
      output => assert(either.isLeft(output)),
    ],
  ],
)
