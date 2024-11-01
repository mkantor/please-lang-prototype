import assert from 'node:assert'
import { either, type Either } from '../adts.js'
import type { ElaborationError } from '../errors.js'
import { type Atom, type Molecule } from '../parsing.js'
import { withPhantomData } from '../phantom-data.js'
import type { Output } from '../semantics.js'
import { testCases } from '../test-utilities.test.js'
import { compile } from './compiler.js'

const success = (
  expectedOutput: Atom | Molecule,
): Either<ElaborationError, Output> =>
  either.makeRight(withPhantomData<never>()(expectedOutput))

testCases(compile, input => `compiling \`${JSON.stringify(input)}\``)(
  'compiler',
  [
    ['Hello, world!', success('Hello, world!')],
    [['@check', true, ['@lookup', ['identity']]], success('true')],
    [
      {
        true1: ['@check', true, ['@lookup', ['identity']]],
        true2: ['@apply', ['@lookup', ['boolean', 'not']], false],
        true3: [
          '@apply',
          [
            '@apply',
            ['@lookup', ['flow']],
            [
              ['@lookup', ['boolean', 'not']],
              ['@lookup', ['boolean', 'not']],
            ],
          ],
          true,
        ],
        false1: ['@check', false, ['@lookup', ['boolean', 'is']]],
        false2: ['@apply', ['@lookup', ['boolean', 'is']], 'not a boolean'],
        false3: [
          '@apply',
          [
            '@apply',
            ['@lookup', ['flow']],
            [
              ['@lookup', ['boolean', 'not']],
              ['@lookup', ['boolean', 'not']],
              ['@lookup', ['boolean', 'not']],
            ],
          ],
          true,
        ],
      },
      success({
        true1: 'true',
        true2: 'true',
        true3: 'true',
        false1: 'false',
        false2: 'false',
        false3: 'false',
      }),
    ],
    [
      ['@runtime', ['@lookup', ['identity']]],
      success({ 0: '@runtime', 1: { 0: '@lookup', 1: { 0: 'identity' } } }),
    ],
    [
      ['@check', 'not a boolean', ['@lookup', ['boolean', 'is']]],
      output => assert(either.isLeft(output)),
    ],
  ],
)
