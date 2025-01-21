import either, { type Either } from '@matt.kantor/either'
import assert from 'node:assert'
import { withPhantomData } from '../../phantom-data.js'
import { testCases } from '../../test-utilities.test.js'
import type { ElaborationError } from '../errors.js'
import { type Atom, type Molecule } from '../parsing.js'
import type { Output } from '../semantics.js'
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
      [
        '@runtime',
        [
          '@apply',
          ['@lookup', ['flow']],
          [
            ['@apply', ['@lookup', ['object', 'lookup']], 'environment'],
            [
              '@apply',
              ['@lookup', ['match']],
              {
                none: 'environment does not exist!',
                some: [
                  '@apply',
                  ['@lookup', ['flow']],
                  [
                    ['@apply', ['@lookup', ['object', 'lookup']], 'lookup'],
                    [
                      '@apply',
                      ['@lookup', ['match']],
                      {
                        none: 'environment.lookup does not exist!',
                        some: ['@apply', ['@lookup', ['apply']], 'PATH'],
                      },
                    ],
                  ],
                ],
              },
            ],
          ],
        ],
      ],
      output => {
        assert(!either.isLeft(output))
        assert(typeof output.value === 'object')
        assert(output.value.tag === 'some')
        assert(typeof output.value.value === 'string')
      },
    ],
    [
      ['@check', 'not a boolean', ['@lookup', ['boolean', 'is']]],
      output => assert(either.isLeft(output)),
    ],
  ],
)
