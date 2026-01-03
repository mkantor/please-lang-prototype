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
    [
      {
        true1: true,
        true2: [
          '@apply',
          [['@index', [['@lookup', ['boolean']], ['not']]], false],
        ],
        false1: 'false',
        false2: [
          '@apply',
          [['@index', [['@lookup', ['boolean']], ['is']]], 'not a boolean'],
        ],
      },
      success({
        true1: 'true',
        true2: 'true',
        false1: 'false',
        false2: 'false',
      }),
    ],
    [
      ['@runtime', [['@lookup', ['identity']]]],
      success({
        0: '@runtime',
        1: { function: { 0: '@lookup', 1: { key: 'identity' } } },
      }),
    ],
    [
      [
        '@runtime',
        [
          [
            '@apply',
            [
              ['@lookup', ['identity']],
              ['@lookup', ['identity']],
            ],
          ],
        ],
      ],
      success({
        0: '@runtime',
        1: { function: { 0: '@lookup', 1: { key: 'identity' } } },
      }),
    ],
    [[['@lookup', ['compose']]], output => assert(either.isLeft(output))],
    [
      ['@runtime', [['@index', [['@lookup', ['boolean']], ['not']]]]],
      output => {
        assert(either.isLeft(output))
        assert(output.value.kind === 'typeMismatch')
      },
    ],
    [
      [
        '@runtime',
        [
          [
            '@apply',
            [
              ['@lookup', ['identity']],
              ['@index', [['@lookup', ['boolean']], ['not']]],
            ],
          ],
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
          [
            '@apply',
            [
              [
                '@apply',
                [
                  ['@lookup', ['flow']],
                  ['@lookup', ['identity']],
                ],
              ],
              ['@lookup', ['identity']],
            ],
          ],
        ],
      ],
      success({
        0: '@runtime',
        1: {
          function: {
            0: '@apply',
            1: {
              function: {
                0: '@apply',
                1: {
                  function: { 0: '@lookup', 1: { key: 'flow' } },
                  argument: { 0: '@lookup', 1: { key: 'identity' } },
                },
              },
              argument: { 0: '@lookup', 1: { key: 'identity' } },
            },
          },
        },
      }),
    ],
    [
      ['@runtime', [['@index', [['@lookup', ['boolean']], ['not']]]]],
      output => {
        assert(either.isLeft(output))
        assert(output.value.kind === 'typeMismatch')
      },
    ],
    [
      {
        0: '@runtime',
        1: {
          function: {
            0: '@apply',
            1: {
              function: {
                0: '@index',
                1: {
                  object: { 0: '@lookup', 1: { key: 'object' } },
                  query: { 0: 'lookup' },
                },
              },
              argument: 'key which does not exist in runtime context',
            },
          },
        },
      },
      success({
        0: '@runtime',
        1: {
          function: {
            0: '@apply',
            1: {
              function: {
                0: '@index',
                1: {
                  object: { 0: '@lookup', 1: { key: 'object' } },
                  query: { 0: 'lookup' },
                },
              },
              argument: 'key which does not exist in runtime context',
            },
          },
        },
      }),
    ],
  ],
)
