import assert from 'node:assert'
import { either, type Either } from '../adts.js'
import type { SyntaxTree } from '../compiling.js'
import type { ElaborationError } from '../errors.js'
import { withPhantomData } from '../phantom-data.js'
import { testCases } from '../test-utilities.test.js'
import { compile } from './compiler.js'
import type { Atom } from './parsing/atom.js'
import type { Molecule } from './parsing/molecule.js'
import type { Canonicalized } from './stages.js'

const success = (
  expectedOutput: Atom | Molecule,
): Either<ElaborationError, SyntaxTree> =>
  either.makeRight(withPhantomData<Canonicalized>()(expectedOutput))

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
            ['@lookup', ['compose']],
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
            ['@lookup', ['compose']],
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
      ['@check', 'not a boolean', ['@lookup', ['boolean', 'is']]],
      output => assert(either.isLeft(output)),
    ],
  ],
)
