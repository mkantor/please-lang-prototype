import either, { type Either } from '@matt.kantor/either'
import type { RuntimeError } from '../errors.js'
import type { JsonValueForbiddingSymbolicKeys } from '../parsing.js'
import { canonicalize } from '../parsing.js'
import { elaborate, serialize, type Output } from '../semantics.js'
import { keywordHandlers } from './keywords.js'

export const evaluate = (
  input: JsonValueForbiddingSymbolicKeys,
): Either<RuntimeError, Output> => {
  const syntaxTree = canonicalize(input)
  const semanticGraphResult = elaborate(syntaxTree, keywordHandlers)
  return either.flatMap(semanticGraphResult, serialize)
}
