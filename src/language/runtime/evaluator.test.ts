import either, { type Either } from '@matt.kantor/either'
import assert from 'node:assert'
import { withPhantomData } from '../../phantom-data.js'
import { testCases } from '../../test-utilities.test.js'
import type { ElaborationError } from '../errors.js'
import {
  canonicalize,
  type Atom,
  type JsonValueForbiddingSymbolicKeys,
  type Molecule,
} from '../parsing.js'
import type { Output } from '../semantics.js'
import { evaluate } from './evaluator.js'

const success = (
  expectedOutput: Atom | Molecule,
): Either<ElaborationError, Output> =>
  either.makeRight(withPhantomData<never>()(expectedOutput))

const canonicalizeAndEvaluate = (input: JsonValueForbiddingSymbolicKeys) =>
  evaluate(canonicalize(input))

testCases(
  canonicalizeAndEvaluate,
  input => `evaluating \`${JSON.stringify(input)}\``,
)('evaluator', [
  ['Hello, world!', success('Hello, world!')],
  [
    ['@apply', [['@lookup', ['identity']], 'Hello, world!']],
    success('Hello, world!'),
  ],
  [
    ['@check', ['not a boolean', ['@index', [['@lookup', ['boolean']], 'is']]]],
    output => assert(either.isLeft(output)),
  ],
])
