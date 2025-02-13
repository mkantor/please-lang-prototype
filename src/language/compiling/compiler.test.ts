import either, { type Either } from '@matt.kantor/either'
import assert from 'node:assert'
import { withPhantomData } from '../../phantom-data.js'
import { testCases } from '../../test-utilities.test.js'
import type { ElaborationError } from '../errors.js'
import { type Atom, type Molecule } from '../parsing.js'
import type { Output } from '../semantics.js'
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
        true2: ['@apply', ['@index', ['@lookup', ['boolean']], ['not']], false],
        true3: [
          '@apply',
          [
            '@apply',
            ['@lookup', ['flow']],
            [
              ['@index', ['@lookup', ['boolean']], ['not']],
              ['@index', ['@lookup', ['boolean']], ['not']],
            ],
          ],
          true,
        ],
        false1: ['@check', false, ['@index', ['@lookup', ['boolean']], ['is']]],
        false2: [
          '@apply',
          ['@index', ['@lookup', ['boolean']], ['is']],
          'not a boolean',
        ],
        false3: [
          '@apply',
          [
            '@apply',
            ['@lookup', ['flow']],
            [
              [
                '@apply',
                ['@lookup', ['flow']],
                [
                  ['@index', ['@lookup', ['boolean']], ['not']],
                  ['@index', ['@lookup', ['boolean']], ['not']],
                ],
              ],
              ['@index', ['@lookup', ['boolean']], ['not']],
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
      success({
        0: '@runtime',
        function: { 0: '@lookup', query: { 0: 'identity' } },
      }),
    ],
    [
      [
        '@runtime',
        ['@apply', ['@lookup', ['identity']], ['@lookup', ['identity']]],
      ],
      success({
        0: '@runtime',
        function: { 0: '@lookup', query: { 0: 'identity' } },
      }),
    ],
    [
      ['@check', 'not a boolean', ['@index', ['@lookup', ['boolean']], ['is']]],
      output => assert(either.isLeft(output)),
    ],
    [['@lookup', ['compose']], output => assert(either.isLeft(output))],
    [
      ['@runtime', ['@index', ['@lookup', ['boolean']], ['not']]],
      output => {
        assert(either.isLeft(output))
        assert(output.value.kind === 'typeMismatch')
      },
    ],
    [
      [
        '@runtime',
        [
          '@apply',
          ['@lookup', ['identity']],
          ['@index', ['@lookup', ['boolean']], ['not']],
        ],
      ],
      output => {
        assert(either.isLeft(output))
        assert(output.value.kind === 'typeMismatch')
      },
    ],
    [
      [
        '@runtime',
        [
          '@apply',
          ['@lookup', ['flow']],
          [
            ['@lookup', ['identity']],
            ['@lookup', ['identity']],
          ],
        ],
      ],
      success({
        0: '@runtime',
        function: {
          0: '@apply',
          function: { 0: '@lookup', query: { 0: 'flow' } },
          argument: {
            0: { 0: '@lookup', query: { 0: 'identity' } },
            1: { 0: '@lookup', query: { 0: 'identity' } },
          },
        },
      }),
    ],
    [
      [
        '@runtime',
        [
          '@apply',
          ['@lookup', ['flow']],
          [
            ['@index', ['@lookup', ['boolean']], ['not']],
            ['@index', ['@lookup', ['boolean']], ['not']],
          ],
        ],
      ],
      output => {
        assert(either.isLeft(output))
        assert(output.value.kind === 'typeMismatch')
      },
    ],
    [
      {
        0: '@runtime',
        function: {
          0: '@apply',
          function: {
            0: '@index',
            object: { 0: '@lookup', query: { 0: 'object' } },
            query: { 0: 'lookup' },
          },
          argument: 'key which does not exist in runtime context',
        },
      },
      success({
        0: '@runtime',
        function: {
          0: '@apply',
          function: {
            0: '@index',
            object: { 0: '@lookup', query: { 0: 'object' } },
            query: { 0: 'lookup' },
          },
          argument: 'key which does not exist in runtime context',
        },
      }),
    ],
  ],
)
