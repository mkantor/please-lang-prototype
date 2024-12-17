import { either, type Either } from '../../adts.js'
import type { CompilationError } from '../errors.js'
import type { JSONValueForbiddingSymbolicKeys } from '../parsing.js'
import { canonicalize } from '../parsing.js'
import { elaborate, serialize, type Output } from '../semantics.js'
import { keywordHandlers } from './semantics/keywords.js'

export const compile = (
  input: JSONValueForbiddingSymbolicKeys,
): Either<CompilationError, Output> => {
  const syntaxTree = canonicalize(input)
  const semanticGraphResult = elaborate(syntaxTree, keywordHandlers)
  return either.flatMap(semanticGraphResult, serialize)
}
