import { either, type Either } from '../../adts.js'
import type { ParseError } from '../errors.js'
import type { SyntaxTree } from './syntax-tree.js'

export const parse = (input: string): Either<ParseError, SyntaxTree> =>
  either.makeLeft({ kind: 'badSyntax', message: 'TODO' }) // TODO
