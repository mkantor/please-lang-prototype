import { either, type Either } from '../adts.js'
import type { RuntimeError } from '../errors.js'
import type { JSONValueForbiddingSymbolicKeys } from '../parsing.js'
import { canonicalize } from '../parsing.js'
import { elaborate, serialize, type Output } from '../semantics.js'
import * as keywordModule from './keywords.js'

export const evaluate = (
  input: JSONValueForbiddingSymbolicKeys,
): Either<RuntimeError, Output> => {
  const syntaxTree = canonicalize(input)
  const semanticGraphResult = elaborate(syntaxTree, keywordModule)
  return either.flatMap(semanticGraphResult, serialize)
}
