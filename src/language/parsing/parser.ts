import { either, type Either } from '../../adts.js'
import type { ParseError } from '../errors.js'
import { type SyntaxTree, syntaxTreeParser } from './syntax-tree.js'

export const parse = (input: string): Either<ParseError, SyntaxTree> =>
  either.match(syntaxTreeParser(input.trim()), {
    left: error => either.makeLeft({ ...error, kind: 'badSyntax' }),
    right: ({ remainingInput, output }) =>
      remainingInput.length !== 0
        ? either.makeLeft({
            kind: 'badSyntax',
            message: 'excess content followed valid input',
            remainingInput,
          })
        : either.makeRight(output),
  })
