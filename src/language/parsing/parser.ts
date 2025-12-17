import either, { type Either } from '@matt.kantor/either'
import parsing from '@matt.kantor/parsing'
import stripAnsi from 'strip-ansi'
import type { ParseError } from '../errors.js'
import { type SyntaxTree, syntaxTreeParser } from './syntax-tree.js'

export const parse = (input: string): Either<ParseError, SyntaxTree> =>
  either.mapLeft(
    parsing.parse(syntaxTreeParser, stripAnsi(input).trim()),
    error => ({
      ...error,
      kind: 'badSyntax',
    }),
  )
