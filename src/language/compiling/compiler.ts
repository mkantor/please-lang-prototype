import either, { type Either } from '@matt.kantor/either'
import type { CompilationError } from '../errors.js'
import type { SyntaxTree } from '../parsing.js'
import { elaborate, serialize, type Output } from '../semantics.js'
import { keywordHandlers } from './semantics/keywords.js'

export const compile = (
  syntaxTree: SyntaxTree,
): Either<CompilationError, Output> => {
  const semanticGraphResult = elaborate(syntaxTree, keywordHandlers)
  return either.flatMap(semanticGraphResult, serialize)
}
