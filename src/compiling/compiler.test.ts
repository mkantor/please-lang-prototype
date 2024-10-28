import { testCases } from '../_lib.test.js'
import type { Either } from '../adts/either.js'
import * as either from '../adts/either.js'
import { withPhantomData } from '../phantom-data.js'
import { compile, type SyntaxTree } from './compiler.js'
import type { ElaborationError } from './errors.js'
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
    [['@check', 'true', ['@lookup', ['identity']]], success('true')],
  ],
)
